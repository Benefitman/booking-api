import express, { Request, Response } from "express";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "./db";
import { Booking } from "./types/booking";
import { createBookingSchema, updateBookingSchema } from "./schemas/booking.schema";

const app = express();
const PORT = 3000;

app.use(express.json());

function toBookingResponse(booking: Booking & { _id: ObjectId }) {
  return {
    id: booking._id.toString(),
    name: booking.name,
    startDate: booking.startDate,
    endDate: booking.endDate,
  };
}

app.get("/api/bookings", async (_req: Request, res: Response) => {
  const db = await connectToDatabase();
  const bookings = await db.collection<Booking>("bookings").find().toArray();

  res.json(
    bookings.map((booking) =>
      toBookingResponse(booking as Booking & { _id: ObjectId })
    )
  );
});

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

async function startServer() {
  await connectToDatabase();

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
