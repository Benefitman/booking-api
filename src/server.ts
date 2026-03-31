import express, { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "./db";
import { Booking } from "./types/booking";
import { createBookingSchema, updateBookingSchema } from "./schemas/booking.schema";

// Express app setup: JSON body parsing, route definitions, etc.
// The server is started at the bottom with startServer().
const app = express();
const PORT = 3000;

app.use(express.json());

// Translate internal Booking object (including MongoDB ObjectId) into public API response.
// The API always exposes string ids, so we stringify ObjectId.
function toBookingResponse(booking: Booking & { _id: ObjectId }) {
  return {
    id: booking._id.toString(),
    name: booking.name,
    startDate: booking.startDate,
    endDate: booking.endDate,
  };
}

// GET /api/bookings: fetch all booking documents and return as normalized responses.
app.get("/api/bookings", async (_req: Request, res: Response) => {
  const db = await connectToDatabase();
  // find() returns a cursor; toArray() eagerly loads all results into memory.
  const bookings = await db.collection<Booking>("bookings").find().toArray();

  // Convert internal objects to API representation and return.
  res.json(
    bookings.map((booking) =>
      toBookingResponse(booking as Booking & { _id: ObjectId })
    )
  );
});

// GET /api/bookings/:id: validate id, fetch exact document, handle 404 if missing.
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

  res.json(toBookingResponse(booking as Booking & { _id: ObjectId }));
});

// POST /api/bookings: validate payload, enforce date rules, insert with generated ObjectId.
app.post("/api/bookings", async (req: Request, res: Response) => {
  const parsed = createBookingSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten(),
    });
  }

  const { name, startDate, endDate } = parsed.data;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ message: "Invalid date format" });
  }

  if (end < start) {
    return res.status(400).json({ message: "endDate cannot be before startDate" });
  }

  const newBooking: Booking = {
    _id: new ObjectId(),
    name,
    startDate,
    endDate,
  };

  const db = await connectToDatabase();
  await db.collection<Booking>("bookings").insertOne(newBooking);

  res.status(201).json(
    toBookingResponse(newBooking as Booking & { _id: ObjectId })
  );
});

// PATCH /api/bookings/:id: allow partial update with validation and date constraints.
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

  const updatedBooking: Booking = {
    _id: existingBooking._id,
    name: parsed.data.name ?? existingBooking.name,
    startDate: parsed.data.startDate ?? existingBooking.startDate,
    endDate: parsed.data.endDate ?? existingBooking.endDate,
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
    {
      $set: {
        name: updatedBooking.name,
        startDate: updatedBooking.startDate,
        endDate: updatedBooking.endDate,
      },
    }
  );

  res.json(toBookingResponse(updatedBooking as Booking & { _id: ObjectId }));
});

// DELETE /api/bookings/:id: remove a booking by id and return the deleted entity reference.
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

  res.json(toBookingResponse(existingBooking as Booking & { _id: ObjectId }));
});

// startServer: ensure DB is reachable before listening on port.
async function startServer() {
  await connectToDatabase();

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
