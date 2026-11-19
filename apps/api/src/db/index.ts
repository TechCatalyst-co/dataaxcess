import "dotenv/config";
import mongoose from "mongoose";

export async function connectDb() {
  await mongoose.connect(process.env.MONGODB_URI ?? "mongodb://localhost:27017/dataaxcess");
}

export { mongoose };
