import { ObjectId } from "mongodb";

export type Booking = {
  _id?: ObjectId;
  name: string;
  startDate: string;
  endDate: string;
};