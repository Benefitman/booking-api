import { z } from "zod";

const productIdSchema = z.enum(["monitor", "keyboard", "mouse"]);

const bookedProductSchema = z.object({
  productId: productIdSchema,
  name: z.string().min(1, "product name is required"),
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