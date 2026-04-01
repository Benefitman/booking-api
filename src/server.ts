import "dotenv/config"; // Load environment variables from .env file
import express, { Request, Response } from "express";
import { basicAuth } from "./middleware/auth";
import { ObjectId, WithId } from "mongodb";
import { connectToDatabase } from "./db";
import { Booking } from "./types/booking";
import { createBookingSchema, updateBookingSchema } from "./schemas/booking.schema";

// Initialize Express app and port
const app = express();
const PORT = 3000;

// Use JSON parser for all incoming requests
app.use(express.json());
app.use("/api/bookings", basicAuth); // Apply basic authentication middleware to all routes

// Map internal Booking document to API response shape, converting ObjectId to string
function toBookingResponse(booking: WithId<Booking>) {
  return {
    id: booking._id.toString(),
    name: booking.name,
    startDate: booking.startDate,
    endDate: booking.endDate,
  };
}

// GET /api/bookings
app.get("/api/bookings", async (_req: Request, res: Response) => {
  const db = await connectToDatabase();
  const bookings = await db.collection<Booking>("bookings").find().toArray();

  res.json(bookings.map(toBookingResponse));
});

// GET /api/bookings/:id
app.get("/api/bookings/:id", async (req: Request<{ id: string }>, res: Response) => {
  // Validate that route parameter is a valid MongoDB ObjectId string
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid booking id" });
  }

  // Connect to DB and fetch booking by ObjectId
  const db = await connectToDatabase();
  const booking = await db
    .collection<Booking>("bookings")
    .findOne({ _id: new ObjectId(req.params.id) });

  // Return 404 when booking does not exist
  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  // Convert MongoDB document to API-friendly response
  res.json(toBookingResponse(booking));
});

// POST /api/bookings
app.post("/api/bookings", async (req: Request, res: Response) => {
  // Validate request body with zod schema
  const parsed = createBookingSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten(),
    });
  }

  const { name, startDate, endDate } = parsed.data;

  // Ensure provided dates are valid
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ message: "Invalid date format" });
  }

  // Enforce business rule: endDate must not be before startDate
  if (end < start) {
    return res.status(400).json({ message: "endDate cannot be before startDate" });
  }

  const db = await connectToDatabase();

  const newBooking = {
    name,
    startDate,
    endDate,
  };

  // Insert booking; MongoDB generates _id automatically
  const result = await db.collection<Booking>("bookings").insertOne(newBooking);

  // Return created booking with string ID
  res.status(201).json({
    id: result.insertedId.toString(),
    name,
    startDate,
    endDate,
  });
});

// PATCH /api/bookings/:id
app.patch("/api/bookings/:id", async (req: Request<{ id: string }>, res: Response) => {
  // Validate route parameter first
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid booking id" });
  }

  // Validate request body for allowed update fields
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

  // Ensure booking exists before update
  const existingBooking = await collection.findOne({ _id: objectId });

  if (!existingBooking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  // Merge update payload with existing values
  const updatedBooking = {
    name: parsed.data.name ?? existingBooking.name,
    startDate: parsed.data.startDate ?? existingBooking.startDate,
    endDate: parsed.data.endDate ?? existingBooking.endDate,
  };

  // Validate date values in merged object
  const start = new Date(updatedBooking.startDate);
  const end = new Date(updatedBooking.endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ message: "Invalid date format" });
  }

  if (end < start) {
    return res.status(400).json({ message: "endDate cannot be before startDate" });
  }

  // Persist update
  await collection.updateOne(
    { _id: objectId },
    { $set: updatedBooking }
  );

  const responseBooking: WithId<Booking> = {
    _id: existingBooking._id,
    name: updatedBooking.name,
    startDate: updatedBooking.startDate,
    endDate: updatedBooking.endDate,
  };

  res.json(toBookingResponse(responseBooking));
});

// DELETE /api/bookings/:id
app.delete("/api/bookings/:id", async (req: Request<{ id: string }>, res: Response) => {
  // Validate route parameter as MongoDB ObjectId
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid booking id" });
  }

  const db = await connectToDatabase();
  const collection = db.collection<Booking>("bookings");
  const objectId = new ObjectId(req.params.id);

  // Check if resource exists before deletion
  const existingBooking = await collection.findOne({ _id: objectId });

  if (!existingBooking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  await collection.deleteOne({ _id: objectId });

  // Return deleted resource representation
  res.json(toBookingResponse(existingBooking));
});

// Start server only after ensuring DB connection works
async function startServer() {
  await connectToDatabase();

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();


//nur autorisiert anfragen mit username und passwort