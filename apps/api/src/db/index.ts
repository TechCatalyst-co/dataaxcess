import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema.js";

export const pool = mysql.createPool({ uri: process.env.DATABASE_URL!, connectionLimit: 10 });
export const db = drizzle({ client: pool, schema, mode: "default" });