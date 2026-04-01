import { ObjectId } from "mongodb";

export type BookedProduct = {
  productId: ObjectId;
  quantity: number;
};

export type Booking = {
  name: string;
  startDate: string;
  endDate: string;
  products: BookedProduct[];
};