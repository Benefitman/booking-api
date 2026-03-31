"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const app = (0, express_1.default)();
const PORT = 3000;
app.use(express_1.default.json());
const filePath = path_1.default.join(__dirname, "..", "data", "bookings.json");
function readBookings() {
    const data = fs_1.default.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
}
function writeBookings(bookings) {
    fs_1.default.writeFileSync(filePath, JSON.stringify(bookings, null, 2), "utf-8");
}
app.get("/api/bookings", (_req, res) => {
    res.json(readBookings());
});
app.get("/api/bookings/:id", (req, res) => {
    const booking = readBookings().find((b) => b.id === req.params.id);
    if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
    }
    res.json(booking);
});
app.post("/api/bookings", (req, res) => {
    const { name, startDate, endDate } = req.body;
    if (!name || !startDate || !endDate) {
        return res.status(400).json({ message: "name, startDate and endDate are required" });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
    }
    if (end < start) {
        return res.status(400).json({ message: "endDate cannot be before startDate" });
    }
    const bookings = readBookings();
    const newBooking = {
        id: crypto_1.default.randomUUID(),
        name,
        startDate,
        endDate
    };
    bookings.push(newBooking);
    writeBookings(bookings);
    res.status(201).json(newBooking);
});
app.patch("/api/bookings/:id", (req, res) => {
    const bookings = readBookings();
    const index = bookings.findIndex((b) => b.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ message: "Booking not found" });
    }
    const updatedBooking = {
        ...bookings[index],
        ...req.body
    };
    if (!updatedBooking.name || !updatedBooking.startDate || !updatedBooking.endDate) {
        return res.status(400).json({ message: "name, startDate and endDate are required" });
    }
    const start = new Date(updatedBooking.startDate);
    const end = new Date(updatedBooking.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
    }
    if (end < start) {
        return res.status(400).json({ message: "endDate cannot be before startDate" });
    }
    bookings[index] = updatedBooking;
    writeBookings(bookings);
    res.json(updatedBooking);
});
app.delete("/api/bookings/:id", (req, res) => {
    const bookings = readBookings();
    const index = bookings.findIndex((b) => b.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ message: "Booking not found" });
    }
    const deletedBooking = bookings[index];
    bookings.splice(index, 1);
    writeBookings(bookings);
    res.json(deletedBooking);
});
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
