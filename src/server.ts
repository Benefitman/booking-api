import express, { Request, Response } from "express";
import { ObjectId, WithId } from "mongodb";
import { connectToDatabase } from "./db";
import { Booking } from "./types/booking";
import { createBookingSchema, updateBookingSchema } from "./schemas/booking.schema";

// Initialize Express app and port constant
const app = express();
const PORT = 3000;

// Middleware: parse JSON payloads on incoming requests
app.use(express.json());

// Convert a MongoDB booking document into a client-safe response
function toBookingResponse(booking: WithId<Booking>) {
  return {
    id: booking._id.toString(), // Convert ObjectId to string
    name: booking.name,
    startDate: booking.startDate,
    endDate: booking.endDate,
    products: booking.products,
  };
}

// GET all bookings
app.get("/api/bookings", async (_req: Request, res: Response) => {
  const db = await connectToDatabase();
  const bookings = await db.collection<Booking>("bookings").find().toArray();

  // Use helper to normalize `_id` and avoid exposing ObjectId directly
  res.json(bookings.map(toBookingResponse));
});

// GET booking by id with validation
app.get("/api/bookings/:id", async (req: Request<{ id: string }>, res: Response) => {
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

  res.json(toBookingResponse(booking));
});

// GET product summary across all bookings
app.get("/api/products/summary", async (_req: Request, res: Response) => {
  const db = await connectToDatabase();
  const collection = db.collection<Booking>("bookings");

  type ProductId = "monitor" | "keyboard" | "mouse";
  type ProductSummaryItem = { _id: ProductId; totalQuantity: number };

  const summary = await collection
    .aggregate<ProductSummaryItem>([
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.productId",
          totalQuantity: { $sum: "$products.quantity" },
        },
      },
    ])
    .toArray();

  const response: Record<ProductId, number> & { total: number } = {
    monitor: 0,
    keyboard: 0,
    mouse: 0,
    total: 0,
  };

  for (const item of summary) {
    if (
      item._id === "monitor" ||
      item._id === "keyboard" ||
      item._id === "mouse"
    ) {
      response[item._id] = item.totalQuantity;
      response.total += item.totalQuantity;
    }
  }

  res.json(response);
});

// POST create new booking
app.post("/api/bookings", async (req: Request, res: Response) => {
  const parsed = createBookingSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten(),
    });
  }

  const { name, startDate, endDate, products } = parsed.data;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ message: "Invalid date format" });
  }

  if (end < start) {
    return res.status(400).json({ message: "endDate cannot be before startDate" });
  }

  const db = await connectToDatabase();

  const newBooking: Booking = {
    name,
    startDate,
    endDate,
    products,
  };

  const result = await db.collection<Booking>("bookings").insertOne(newBooking);

  // Return a response with the inserted id as a string
  res.status(201).json({
    id: result.insertedId.toString(),
    name,
    startDate,
    endDate,
    products,
  });
});

// PATCH update existing booking by id
app.patch("/api/bookings/:id", async (req: Request<{ id: string }>, res: Response) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid booking id" });
  }

  const parsed = updateBookingSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten(),
    });
  }

  const db = await connectToDatabase();
  const collection = db.collection<Booking>("bookings");
  const objectId = new ObjectId(req.params.id);

  const existingBooking = await collection.findOne({ _id: objectId });

  if (!existingBooking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  const updatedBooking = {
    name: parsed.data.name ?? existingBooking.name,
    startDate: parsed.data.startDate ?? existingBooking.startDate,
    endDate: parsed.data.endDate ?? existingBooking.endDate,
    products: parsed.data.products ?? existingBooking.products,
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

  res.json(toBookingResponse(responseBooking));
});

// DELETE booking by id
app.delete("/api/bookings/:id", async (req: Request<{ id: string }>, res: Response) => {
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

  res.json(toBookingResponse(existingBooking));
});

// Start server only after DB connection is ready
async function startServer() {
  await connectToDatabase();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
