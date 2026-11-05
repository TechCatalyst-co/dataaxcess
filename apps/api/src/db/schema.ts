import {
  mysqlTable, int, varchar, char, text, date, decimal, datetime, timestamp, mysqlEnum, index,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 100 }).notNull(),
  role: mysqlEnum("role", ["admin", "agent"]).notNull().default("agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const sessions = mysqlTable("sessions", {
  id: char("id", { length: 64 }).primaryKey(), // SHA-256 of the cookie token
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: datetime("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const invoices = mysqlTable("invoices", {
  // identity
  invoiceNumber: varchar("invoice_number", { length: 50 }).primaryKey(),
  vin: char("vin", { length: 17 }).notNull().unique(),
  vehicleStock: varchar("vehicle_stock", { length: 50 }),
  // vehicle
  year: int("year").notNull(),
  make: varchar("make", { length: 50 }).notNull(),
  model: varchar("model", { length: 50 }).notNull(),
  bodyStyle: varchar("body_style", { length: 30 }),
  countryOfOrigin: varchar("country_of_origin", { length: 50 }),
  odometer: int("odometer"),
  titleStatus: varchar("title_status", { length: 30 }),
  damageHistory: text("damage_history"),
  // sale
  saleDate: date("sale_date", { mode: "string" }),
  dateOfSale: date("date_of_sale", { mode: "string" }),
  vehiclePrice: decimal("vehicle_price", { precision: 10, scale: 2 }),
  totalSales: decimal("total_sales", { precision: 10, scale: 2 }),
  auctionSource: varchar("auction_source", { length: 100 }),
  // buyer
  buyerType: varchar("buyer_type", { length: 20 }),
  buyerCompany: varchar("buyer_company", { length: 100 }),
  buyerAddress: varchar("buyer_address", { length: 200 }),
  buyerCity: varchar("buyer_city", { length: 100 }),
  buyerRfc: varchar("buyer_rfc", { length: 20 }),
  // verification
  dataAnalyst: varchar("data_analyst", { length: 255 }),
  sourceVerification: varchar("source_verification", { length: 50 }),
  verified: varchar("verified", { length: 10 }).default("No"),
  reportDate: datetime("report_date").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  index("invoices_year_idx").on(t.year),
  index("invoices_title_status_idx").on(t.titleStatus),
  index("invoices_date_of_sale_idx").on(t.dateOfSale),
  index("invoices_buyer_type_idx").on(t.buyerType),
]);