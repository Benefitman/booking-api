import { MongoClient, Db } from "mongodb";

// MongoDB connection URI (local development default)
const uri = "mongodb://127.0.0.1:27017";
// Single MongoClient instance reused across requests (best practice)
const client = new MongoClient(uri);

// Cached Db instance to avoid reconnecting on each request
let db: Db | null = null;
// Promise to avoid race conditions when multiple callers request connection concurrently
let connectPromise: Promise<MongoClient> | null = null;

export async function connectToDatabase(): Promise<Db> {
  // Return cached connection if already established
  if (db) {
    return db;
  }

  // If no connection attempt is in progress, start one and keep the promise
  if (!connectPromise) {
    connectPromise = client.connect();
  }

  // Await the in-flight connection attempt (or the one just created)
  await connectPromise;

  // Use the database name for this app
  db = client.db("booking_app");

  // Return the cached Db object for future invocations
  return db;
}