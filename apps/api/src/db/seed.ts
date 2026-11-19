import argon2 from "argon2";
import { connectDb, mongoose } from "./index.js";
import { User, Session, Invoice } from "./schema.js";

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
if (!username || !password || password.length < 12) {
  console.error("Set ADMIN_USERNAME and ADMIN_PASSWORD (12+ chars) first.");
  await mongoose.disconnect();
  process.exitCode = 1;
} else {
  try {
    await connectDb();
    await User.createIndexes();
    await Session.createIndexes();
    await Invoice.createIndexes();
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const existing = await User.findOne({ username }).lean();
    if (existing) {
      await User.updateOne({ _id: existing._id }, { passwordHash, role: "admin", updatedAt: new Date() });
      console.log(`Updated admin "${username}"`);
    } else {
      await User.create({ username, passwordHash, fullName: username, role: "admin" });
      console.log(`Created admin "${username}"`);
    }
  } finally {
    await mongoose.disconnect();
  }
}
