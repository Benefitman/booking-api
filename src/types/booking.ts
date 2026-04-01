import { ObjectId } from "mongodb";

export type BookedProduct = {
  productId: "monitor" | "keyboard" | "mouse";
  name: string;
  quantity: number;
};

export type Booking = {
  _id?: ObjectId;
  name: string;
  startDate: string;
  endDate: string;
  products: BookedProduct[];
};