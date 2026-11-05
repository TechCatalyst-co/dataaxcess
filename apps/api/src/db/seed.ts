import argon2 from "argon2";
import { db, pool } from "./index.js";
import { users } from "./schema.js";
import { eq } from "drizzle-orm";

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
if (!username || !password || password.length < 12) {
  console.error("Set ADMIN_USERNAME and ADMIN_PASSWORD (12+ chars) first.");
  await pool.end();
  process.exitCode = 1;
} else {
  try {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (existing) {
      await db.update(users).set({ passwordHash, role: "admin" }).where(eq(users.id, existing.id));
      console.log(`Updated admin "${username}"`);
    } else {
      await db.insert(users).values({ username, passwordHash, fullName: username, role: "admin" });
      console.log(`Created admin "${username}"`);
    }
  } finally {
    await pool.end();
  }
}
