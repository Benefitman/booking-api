import { z } from "zod";

const bookedProductSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  quantity: z.number().int().min(1, "quantity must be at least 1"),
});

export const createBookingSchema = z.object({
  name: z.string().min(1, "name is required"),
  startDate: z.string().min(1, "startDate is required"),
  endDate: z.string().min(1, "endDate is required"),
  products: z.array(bookedProductSchema).min(1, "at least one product is required"),
});

export const updateBookingSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  products: z.array(bookedProductSchema).optional(),
});