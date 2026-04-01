import express, { Request, Response } from "express";
import { ObjectId, WithId, Db } from "mongodb";
import { connectToDatabase } from "./db";
import { Booking } from "./types/booking";
import { Product } from "./types/product";
import { createProductSchema } from "./schemas/product.schema";
import { z } from "zod";
import { createBookingSchema, updateBookingSchema } from "./schemas/booking.schema";



const app = express();
// Use JSON body parsing for all incoming requests so we can access req.body.
const PORT = 3000;

app.use(express.json());

async function toBookingResponse(db: Db, booking: WithId<Booking>) {
  // Convert booking to API response shape with product names resolved from DB.
  const productIds = booking.products.map((p) => p.productId);

  const productsFromDb = await db
    .collection("products")
    .find({ _id: { $in: productIds } })
    .toArray();

  const products = booking.products.map((bookedProduct) => {
    const product = productsFromDb.find((p) => p._id.equals(bookedProduct.productId));

    return {
      productId: bookedProduct.productId.toString(),
      name: product?.name ?? "Unknown product",
      quantity: bookedProduct.quantity,
    };
  });

  return {
    id: booking._id.toString(),
    name: booking.name,
    startDate: booking.startDate,
    endDate: booking.endDate,
    products,
  };
}

app.get("/api/products", async (_req: Request, res: Response) => {
  // Retrieve all products for the basic product catalog route.
  const db = await connectToDatabase();
  const products = await db.collection<Product>("products").find().toArray();

  res.json(
    products.map((product) => ({
      id: product._id.toString(),
      name: product.name,
    }))
  );
});

app.post("/api/products", async (req: Request, res: Response) => {
  // Create a new product, ensuring the payload is valid and no duplicate name exists.
  const parsed = createProductSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: z.flattenError(parsed.error),
    });
  }

  const db = await connectToDatabase();
  const collection = db.collection<Product>("products");

  const existingProduct = await collection.findOne({ name: parsed.data.name });

  if (existingProduct) {
    return res.status(400).json({ message: "Product already exists" });
  }

  const newProduct: Product = {
    name: parsed.data.name,
  };

  const result = await collection.insertOne(newProduct);

  res.status(201).json({
    id: result.insertedId.toString(),
    name: newProduct.name,
  });
});

app.delete("/api/products/:id", async (req: Request<{ id: string }>, res: Response) => {
  // Delete a product and clean up bookings that include it.
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid product id" });
  }

  const db = await connectToDatabase();
  const productsCollection = db.collection<Product>("products");
  const bookingsCollection = db.collection<Booking>("bookings");
  const productId = new ObjectId(req.params.id);

  const existingProduct = await productsCollection.findOne({ _id: productId });

  if (!existingProduct) {
    return res.status(404).json({ message: "Product not found" });
  }

  await productsCollection.deleteOne({ _id: productId });

  await bookingsCollection.updateMany(
    {},
    {
      $pull: {
        products: { productId: productId },
      },
    }
  );

  res.json({
    id: existingProduct._id.toString(),
    name: existingProduct.name,
  });
});



app.get("/api/bookings", async (_req: Request, res: Response) => {
  // List all bookings with expanded product details.
  const db = await connectToDatabase();
  const bookings = await db.collection<Booking>("bookings").find().toArray();

  const response = await Promise.all(
    bookings.map((booking) => toBookingResponse(db, booking))
  );

  res.json(response);
});

app.get("/api/bookings/:id", async (req: Request<{ id: string }>, res: Response) => {
  // Validate path parameter to avoid invalid ObjectId errors in MongoDB.
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid booking id" });
  }

  const db = await connectToDatabase();
  const booking = await db
    .collection<Booking>("bookings")
    .findOne({ _id: new ObjectId(req.params.id) });

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  const response = await toBookingResponse(db, booking);
  res.json(response);
});


app.get("/api/products/summary", async (_req: Request, res: Response) => {
  const db = await connectToDatabase();
  const collection = db.collection<Booking>("bookings");

  type SummaryItem = { _id: string; totalQuantity: number };

  const summary = await collection
    .aggregate<SummaryItem>([
      { $unwind: "$products" },
      {
        $lookup: {
          from: "products",
          localField: "products.productId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $group: {
          _id: "$productDetails.name",
          totalQuantity: { $sum: "$products.quantity" },
        },
      },
    ])
    .toArray();

  const response: Record<string, number> = {
    total: 0,
  };

  for (const item of summary) {
    response[item._id] = item.totalQuantity;
    response.total += item.totalQuantity;
  }

  res.json(response);
});


app.post("/api/bookings", async (req: Request, res: Response) => {
  // Validate incoming payload with Zod schema before any DB operations.
  const parsed = createBookingSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: z.flattenError(parsed.error),
    });
  }

  const { name, startDate, endDate, products } = parsed.data;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ message: "Invalid date format" });
  }

  if (end < start) {
    // Business rule: end must be on or after start.
    return res.status(400).json({ message: "endDate cannot be before startDate" });
  }

  // Validate each product reference is a proper ObjectId.
  for (const product of products) {
    if (!ObjectId.isValid(product.productId)) {
      return res.status(400).json({ message: `Invalid product id: ${product.productId}` });
    }
  }

  const db = await connectToDatabase();
  const productsCollection = db.collection("products");

  const productObjectIds = products.map((p) => new ObjectId(p.productId));

  const existingProducts = await productsCollection
    .find({ _id: { $in: productObjectIds } })
    .toArray();

  if (existingProducts.length !== products.length) {
    return res.status(400).json({ message: "One or more product ids do not exist" });
  }

  const normalizedProducts = products.map((p) => ({
    productId: new ObjectId(p.productId),
    quantity: p.quantity,
  }));

  const newBooking: Booking = {
    name,
    startDate,
    endDate,
    products: normalizedProducts,
  };

  const result = await db.collection<Booking>("bookings").insertOne(newBooking);

  const insertedBooking: WithId<Booking> = {
    _id: result.insertedId,
    name,
    startDate,
    endDate,
    products: normalizedProducts,
  };

  const response = await toBookingResponse(db, insertedBooking);
  res.status(201).json(response);
});

app.patch("/api/bookings/:id", async (req: Request<{ id: string }>, res: Response) => {
  // Patch route: partial update allowed, with schema-based validation.
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid booking id" });
  }

  const parsed = updateBookingSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: z.flattenError(parsed.error),
    });
  }

  const db = await connectToDatabase();
  const collection = db.collection<Booking>("bookings");
  const productsCollection = db.collection("products");
  const objectId = new ObjectId(req.params.id);

  const existingBooking = await collection.findOne({ _id: objectId });

  if (!existingBooking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  let normalizedProducts = existingBooking.products;

  if (parsed.data.products) {
    for (const product of parsed.data.products) {
      if (!ObjectId.isValid(product.productId)) {
        return res.status(400).json({ message: `Invalid product id: ${product.productId}` });
      }
    }

    const productObjectIds = parsed.data.products.map(
      (p) => new ObjectId(p.productId)
    );

    const existingProducts = await productsCollection
      .find({ _id: { $in: productObjectIds } })
      .toArray();

    if (existingProducts.length !== parsed.data.products.length) {
      return res.status(400).json({ message: "One or more product ids do not exist" });
    }

    normalizedProducts = parsed.data.products.map((p) => ({
      productId: new ObjectId(p.productId),
      quantity: p.quantity,
    }));
  }

  const updatedBooking: Booking = {
    name: parsed.data.name ?? existingBooking.name,
    startDate: parsed.data.startDate ?? existingBooking.startDate,
    endDate: parsed.data.endDate ?? existingBooking.endDate,
    products: normalizedProducts,
  };

  const start = new Date(updatedBooking.startDate);
  const end = new Date(updatedBooking.endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ message: "Invalid date format" });
  }

  if (end < start) {
    return res.status(400).json({ message: "endDate cannot be before startDate" });
  }

  await collection.updateOne(
    { _id: objectId },
    { $set: updatedBooking }
  );

  const responseBooking: WithId<Booking> = {
    _id: existingBooking._id,
    name: updatedBooking.name,
    startDate: updatedBooking.startDate,
    endDate: updatedBooking.endDate,
    products: updatedBooking.products,
  };

  const response = await toBookingResponse(db, responseBooking);
  res.json(response);
});

app.delete("/api/bookings/:id", async (req: Request<{ id: string }>, res: Response) => {
  // Delete route: first confirm booking existence, then remove it.
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid booking id" });
  }

  const db = await connectToDatabase();
  const collection = db.collection<Booking>("bookings");
  const objectId = new ObjectId(req.params.id);

  const existingBooking = await collection.findOne({ _id: objectId });

  if (!existingBooking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  await collection.deleteOne({ _id: objectId });

  const response = await toBookingResponse(db, existingBooking);
  res.json(response);
});

async function startServer() {
  // Ensure DB connection resolves before listening for traffic.
  await connectToDatabase();

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();