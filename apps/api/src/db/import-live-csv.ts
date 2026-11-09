import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { db, pool } from "./index.js";
import { invoices, users } from "./schema.js";

type CsvRow = Record<string, string | undefined>;
const args = process.argv.slice(2);
const getArg = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const apply = args.includes("--apply");
const checkTarget = apply || args.includes("--check-target");
const usersPath = getArg("--users");
const productsPath = getArg("--products");
if (!usersPath || !productsPath) {
  console.error("Usage: npm run db:import-live-csv -w @dataaxcess/api -- --users <tbl_user.csv> --products <tbl_product.csv> [--apply]");
  process.exitCode = 1;
} else {
  const analystMap = new Map<string, string>([
    // Confirmed conservative mappings; unmatched analysts remain unassigned.
    ["N.Sierra", "Nsierra"],
  ]);
  const yearCorrections = new Map<string, number>([
    ["5528", 2018],
    ["6486", 2019],
    ["6822", 2019],
    ["7598", 2019],
    ["7808", 2020],
    ["8203", 2021],
    ["8292", 2019],
    ["8295", 2021],
    ["9152", 2016],
    ["9297", 2020],
  ]);
  const parseCsv = async (path: string): Promise<CsvRow[]> => {
    const input = (await readFile(resolve(path), "utf8")).replace(/^\uFEFF/, "");
    const records: string[][] = [];
    let record: string[] = [];
    let field = "";
    let quoted = false;
    for (let i = 0; i < input.length; i++) {
      const char = input[i]!;
      if (quoted) {
        if (char === '"' && input[i + 1] === '"') { field += '"'; i++; }
        else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"' && field.length === 0) quoted = true;
      else if (char === ",") { record.push(field); field = ""; }
      else if (char === "\n" || char === "\r") {
        if (char === "\r" && input[i + 1] === "\n") i++;
        record.push(field); field = "";
        if (record.some((value) => value.length > 0)) records.push(record);
        record = [];
      } else field += char;
    }
    if (quoted) throw new Error(`CSV has an unterminated quoted field: ${path}`);
    if (field.length || record.length) { record.push(field); if (record.some((value) => value.length > 0)) records.push(record); }
    const headers = records.shift();
    if (!headers?.length) throw new Error(`CSV is empty: ${path}`);
    return records.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]])));
  };
  const clean = (value: string | undefined) => (value ?? "").trim();
  const nullable = (value: string | undefined) => clean(value) || null;
  const validDate = (value: string | undefined) => {
    const candidate = clean(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(candidate) && !candidate.startsWith("0000-") ? candidate : null;
  };

  try {
    const userRows = await parseCsv(usersPath);
    const productRows = await parseCsv(productsPath);
    const preparedUsers = userRows.map((row, index) => {
      const username = clean(row.user);
      const password = row.pass ?? "";
      const status = clean(row.status).toLowerCase();
      const errors: string[] = [];
      if (!username || username.length > 50) errors.push("invalid username");
      if (!password || password.length > 200) errors.push("password outside supported login length");
      if (status !== "admin" && status !== "user") errors.push("unknown role status");
      return { rowNumber: index + 2, username, password, role: status === "admin" ? "admin" as const : "agent" as const, errors };
    });
    const usernameCounts = new Map<string, number>();
    for (const row of preparedUsers) usernameCounts.set(row.username.toLowerCase(), (usernameCounts.get(row.username.toLowerCase()) ?? 0) + 1);
    for (const row of preparedUsers) if ((usernameCounts.get(row.username.toLowerCase()) ?? 0) > 1) row.errors.push("duplicate username after trimming/case folding");

    const preparedInvoices = productRows.map((row, index) => {
      const invoiceNumber = clean(row.Invoice);
      const vin = clean(row.VIN).toUpperCase();
      const yearText = clean(row.Year);
      const year = yearCorrections.get(invoiceNumber) ?? Number(yearText);
      const odometerText = clean(row.Odometer);
      const odometer = Number(odometerText);
      const totalSales = clean(row.Total_Sales);
      const vehiclePrice = clean(row.Vehicle_Price);
      const errors: string[] = [];
      if (!invoiceNumber || invoiceNumber.length > 50) errors.push("invalid invoice number");
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) errors.push("invalid VIN");
      if (!Number.isInteger(year) || year < 1886 || year > 2100) errors.push("invalid year");
      if (!clean(row.Make) || clean(row.Make).length > 50) errors.push("invalid make");
      if (!clean(row.Model) || clean(row.Model).length > 50) errors.push("invalid model");
      if (odometerText && (!Number.isInteger(odometer) || odometer < 0)) errors.push("invalid odometer");
      if (totalSales && !/^\d{1,8}(\.\d{1,2})?$/.test(totalSales)) errors.push("invalid total sales");
      if (vehiclePrice && !/^\d{1,8}(\.\d{1,2})?$/.test(vehiclePrice)) errors.push("invalid vehicle price");
      for (const [key, max] of [["BodyStyle", 30], ["CountryOfOrigin", 50], ["TitleStatus", 30], ["AuctionSource", 100], ["Vehicle_Stock", 50], ["BuyerType", 20], ["Buyer_Company", 100], ["Buyer_Address", 200], ["Buyer_City", 100], ["Buyer_RFC", 20], ["Data_Analyst", 255], ["SourceVerification", 50]] as const) {
        if (clean(row[key]).length > max) errors.push(`${key} exceeds ${max} characters`);
      }
      return { rowNumber: index + 2, invoiceNumber, vin, year, odometer: odometerText ? odometer : null, row, errors };
    });

    const duplicateValues = (values: string[]) => new Set(values.filter((value, index) => values.indexOf(value) !== index));
    const duplicateInvoices = duplicateValues(preparedInvoices.map((row) => row.invoiceNumber));
    const duplicateVins = duplicateValues(preparedInvoices.map((row) => row.vin));
    for (const row of preparedInvoices) {
      if (duplicateInvoices.has(row.invoiceNumber)) row.errors.push("duplicate invoice number");
      if (duplicateVins.has(row.vin)) row.errors.push("duplicate VIN");
    }

    let existingUsernames = new Set<string>();
    let existingInvoiceNumbers = new Set<string>();
    if (checkTarget) {
      const existingUsers = await db.select({ username: users.username }).from(users);
      existingUsernames = new Set(existingUsers.map((user) => user.username.toLowerCase()));
      const existingInvoices = await db.select({ invoiceNumber: invoices.invoiceNumber }).from(invoices);
      existingInvoiceNumbers = new Set(existingInvoices.map((invoice) => invoice.invoiceNumber));
    }
    for (const row of preparedUsers) if (existingUsernames.has(row.username.toLowerCase())) row.errors.push("username already exists in target database");
    for (const row of preparedInvoices) if (existingInvoiceNumbers.has(row.invoiceNumber)) row.errors.push("invoice number already exists in target database");

    const failures = [...preparedUsers.flatMap((row) => row.errors.map((reason) => `users CSV row ${row.rowNumber}: ${reason}`)), ...preparedInvoices.flatMap((row) => row.errors.map((reason) => `products CSV row ${row.rowNumber}: ${reason}`))];
    const analysts = [...new Set(preparedInvoices.map((row) => clean(row.row.Data_Analyst)).filter(Boolean))];
    const report = {
      mode: apply ? "apply" : "dry-run",
      targetChecked: checkTarget,
      users: { sourceRows: preparedUsers.length, importable: preparedUsers.filter((row) => !row.errors.length).length, roles: Object.fromEntries(["admin", "user"].map((role) => [role, preparedUsers.filter((row) => clean(userRows.find((source) => clean(source.user) === row.username)?.status).toLowerCase() === role).length])) },
      invoices: { sourceRows: preparedInvoices.length, importable: preparedInvoices.filter((row) => !row.errors.length).length },
      analystMapping: Object.fromEntries(analysts.map((analyst) => [analyst, analystMap.get(analyst) ?? null])),
      warnings: ["ReportDate values are not imported; the database default records import time.", "Passwords are converted directly to Argon2 hashes and are never printed."],
      failures,
    };
    console.log(JSON.stringify(report, null, 2));
    if (failures.length || !apply) {
      if (failures.length) process.exitCode = 1;
    } else {
      await db.transaction(async (tx) => {
        const ids = new Map<string, number>();
        for (const row of preparedUsers) {
          const passwordHash = await argon2.hash(row.password, { type: argon2.argon2id });
          await tx.insert(users).values({ username: row.username, passwordHash, fullName: row.username, role: row.role });
          const [created] = await tx.select({ id: users.id }).from(users).where(eq(users.username, row.username)).limit(1);
          if (created) ids.set(row.username, created.id);
        }
        const analystToId = new Map<string, number>();
        for (const [analyst, username] of analystMap) {
          const id = ids.get(username);
          if (typeof id === "number") analystToId.set(analyst, id);
        }
        for (const row of preparedInvoices) {
          const source = row.row;
          const analyst = clean(source.Data_Analyst);
          await tx.insert(invoices).values({
            invoiceNumber: row.invoiceNumber,
            createdByUserId: analystToId.get(analyst) ?? null,
            vin: row.vin,
            year: row.year,
            make: clean(source.Make),
            model: clean(source.Model),
            bodyStyle: nullable(source.BodyStyle),
            countryOfOrigin: nullable(source.CountryOfOrigin),
            odometer: row.odometer,
            titleStatus: nullable(source.TitleStatus),
            damageHistory: nullable(source.DamageHistory),
            vehicleStock: nullable(source.Vehicle_Stock),
            saleDate: validDate(source.Sale_Date),
            dateOfSale: validDate(source.DateOfSale),
            vehiclePrice: nullable(source.Vehicle_Price),
            totalSales: nullable(source.Total_Sales),
            auctionSource: nullable(source.AuctionSource),
            buyerType: nullable(source.BuyerType),
            buyerCompany: nullable(source.Buyer_Company),
            buyerAddress: nullable(source.Buyer_Address),
            buyerCity: nullable(source.Buyer_City),
            buyerRfc: nullable(source.Buyer_RFC),
            dataAnalyst: nullable(source.Data_Analyst),
            sourceVerification: nullable(source.SourceVerification),
            verified: nullable(source.Verified),
          });
        }
      });
      console.log(`Imported ${preparedUsers.length} users and ${preparedInvoices.length} invoices.`);
    }
  } catch (error) {
    console.error("Live CSV import failed:", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
