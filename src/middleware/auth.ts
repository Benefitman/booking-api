import { Request, Response, NextFunction } from "express";

// Fetch basic auth credentials from environment variables for security.
// These must be configured before starting the app.
const AUTH_USERNAME = process.env.AUTH_USERNAME;
const AUTH_PASSWORD = process.env.AUTH_PASSWORD;

/**
 * Basic HTTP auth middleware.
 * 1) Verifies Authorization header is present and uses Basic scheme.
 * 2) Decodes Base64 credentials to username:password.
 * 3) Compares against environment credentials.
 * 4) Returns 401 + WWW-Authenticate on any failure.
 */
export function basicAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // Reject missing header or wrong scheme.
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="bookings"');
    return res.status(401).json({ message: "Authentication required" });
  }

  // Extract Base64-encoded part and decode credentials.
  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");

  // Expect format username:password.
  const [username, password] = credentials.split(":");

  // Validate credentials against configured values.
  if (username !== AUTH_USERNAME || password !== AUTH_PASSWORD) {
    res.setHeader("WWW-Authenticate", 'Basic realm="bookings"');
    return res.status(401).json({ message: "Invalid username or password" });
  }

  // Auth successful: continue to next middleware/route.
  next();
}