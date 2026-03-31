import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const app = express();
const PORT = 3000;

// Middleware zum Parsen von JSON-Request-Bodies
app.use(express.json());

// Typ-Definition für ein Booking-Objekt
type Booking = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

// Pfad zur JSON-Datei für persistente Speicherung
const filePath = path.join(__dirname, "..", "data", "bookings.json");

// Liest alle Bookings aus der JSON-Datei
function readBookings(): Booking[] {
  const data = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(data);
}

// Schreibt alle Bookings in die JSON-Datei mit Formatierung
function writeBookings(bookings: Booking[]): void {
  fs.writeFileSync(filePath, JSON.stringify(bookings, null, 2), "utf-8");
}

// GET: Alle Bookings abrufen
app.get("/api/bookings", (_req: Request, res: Response) => {
  res.json(readBookings());
});

// GET: Ein spezifisches Booking nach ID abrufen
app.get("/api/bookings/:id", (req: Request, res: Response) => {
  const booking = readBookings().find((b) => b.id === req.params.id);

  // Fehlerbehandlung: Booking nicht gefunden
  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  res.json(booking);
});

// POST: Neues Booking erstellen
app.post("/api/bookings", (req: Request, res: Response) => {
  const { name, startDate, endDate } = req.body;

  // Validierung: Erforderliche Felder prüfen
  if (!name || !startDate || !endDate) {
    return res.status(400).json({ message: "name, startDate and endDate are required" });
  }

  // Datum-Objekte erstellen zur Validierung
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validierung: Gültige Datumsformat prüfen
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ message: "Invalid date format" });
  }

  // Validierung: Enddatum darf nicht vor Startdatum liegen
  if (end < start) {
    return res.status(400).json({ message: "endDate cannot be before startDate" });
  }

  const bookings = readBookings();

  // Neues Booking mit eindeutiger ID erstellen
  const newBooking: Booking = {
    id: crypto.randomUUID(),
    name,
    startDate,
    endDate
  };

  // Neues Booking zur Liste hinzufügen und speichern
  bookings.push(newBooking);
  writeBookings(bookings);

  res.status(201).json(newBooking);
});

// PATCH: Bestehendes Booking aktualisieren
app.patch("/api/bookings/:id", (req: Request, res: Response) => {
  const bookings = readBookings();
  // Index des Bookings suchen
  const index = bookings.findIndex((b) => b.id === req.params.id);

  // Fehlerbehandlung: Booking nicht gefunden
  if (index === -1) {
    return res.status(404).json({ message: "Booking not found" });
  }

  // Bestehendes Booking mit neuen Daten mergen
  const updatedBooking: Booking = {
    ...bookings[index],
    ...req.body
  };

  // Validierung: Erforderliche Felder prüfen
  if (!updatedBooking.name || !updatedBooking.startDate || !updatedBooking.endDate) {
    return res.status(400).json({ message: "name, startDate and endDate are required" });
  }

  // Validierung: Gültige Datumsformat prüfen
  const start = new Date(updatedBooking.startDate);
  const end = new Date(updatedBooking.endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res.status(400).json({ message: "Invalid date format" });
  }

  // Validierung: Enddatum darf nicht vor Startdatum liegen
  if (end < start) {
    return res.status(400).json({ message: "endDate cannot be before startDate" });
  }

  // Aktualisiertes Booking speichern
  bookings[index] = updatedBooking;
  writeBookings(bookings);

  res.json(updatedBooking);
});

// DELETE: Booking löschen
app.delete("/api/bookings/:id", (req: Request, res: Response) => {
  const bookings = readBookings();
  // Index des Bookings suchen
  const index = bookings.findIndex((b) => b.id === req.params.id);

  // Fehlerbehandlung: Booking nicht gefunden
  if (index === -1) {
    return res.status(404).json({ message: "Booking not found" });
  }

  // Gelöschtes Booking speichern für Response
  const deletedBooking = bookings[index];
  // Booking aus Array entfernen
  bookings.splice(index, 1);
  // Änderungen speichern
  writeBookings(bookings);

  res.json(deletedBooking);
});

// Server starten und auf dem angegebenen Port lauschen
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});