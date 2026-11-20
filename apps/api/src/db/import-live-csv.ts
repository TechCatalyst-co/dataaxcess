import "dotenv/config";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import argon2 from "argon2";
import { connectDb, mongoose } from "./index.js";
import { defaultInvoiceExpirationDays, getInvoiceExpirationDays, invoiceExpirationCutoff } from "./invoice-archive.js";
import { User, Invoice } from "./schema.js";

type CsvRow = Record<string, string | undefined>;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
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
    ["N.Sierra", "Nsierra"],
    ["B LOPEZ", "BrizaLopez"],
    ["K. Ruiz", "KarolinaRuiz"],
    ["K.Ruiz", "KarolinaRuiz"],
    ["K Ruiz", "KarolinaRuiz"],
    ["J.Rayas", "FaridRayas"],
    ["J. Rayas", "FaridRayas"],
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
  const parseCsv = async (path: string, requiredHeaders: string[]): Promise<CsvRow[]> => {
    const candidates = isAbsolute(path) ? [path] : [resolve(path), resolve(repoRoot, path)];
    let rawInput: string | undefined;
    for (const candidate of candidates) {
      try {
        rawInput = await readFile(candidate, "utf8");
        break;
      } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
      }
    }
    if (rawInput === undefined) throw new Error(`CSV file not found: ${path}`);
    const input = rawInput.replace(/^\uFEFF/, "");
    const records: string[][] = [];
    let record: string[] = [];
    let field = "";
    let quoted = false;
    let closedQuote = false;
    for (let i = 0; i < input.length; i++) {
      const char = input[i]!;
      if (quoted) {
        if (char === '"' && input[i + 1] === '"') { field += '"'; i++; }
        else if (char === '"') { quoted = false; closedQuote = true; }
        else field += char;
      } else if (char === '"' && field.length === 0 && !closedQuote) quoted = true;
      else if (char === ",") { record.push(field); field = ""; closedQuote = false; }
      else if (char === "\n" || char === "\r") {
        if (char === "\r" && input[i + 1] === "\n") i++;
        record.push(field); field = "";
        if (record.some((value) => value.length > 0)) records.push(record);
        record = [];
        closedQuote = false;
      } else {
        if (closedQuote) throw new Error(`Unexpected character after a quoted CSV field: ${path}`);
        field += char;
      }
    }
    if (quoted) throw new Error(`CSV has an unterminated quoted field: ${path}`);
    if (field.length || record.length) { record.push(field); if (record.some((value) => value.length > 0)) records.push(record); }
    const headers = records.shift();
    if (!headers?.length) throw new Error(`CSV is empty: ${path}`);
    const normalizedHeaders = headers.map((header) => header.trim());
    if (normalizedHeaders.some((header) => !header) || new Set(normalizedHeaders).size !== normalizedHeaders.length) {
      throw new Error(`CSV has empty or duplicate headers: ${path}`);
    }
    const missingHeaders = requiredHeaders.filter((header) => !normalizedHeaders.includes(header));
    if (missingHeaders.length) throw new Error(`CSV is missing required headers (${missingHeaders.join(", ")}): ${path}`);
    return records.map((values, index) => {
      if (values.length !== normalizedHeaders.length) {
        throw new Error(`CSV record ${index + 2} has ${values.length} fields; expected ${normalizedHeaders.length}: ${path}`);
      }
      return Object.fromEntries(normalizedHeaders.map((header, headerIndex) => [header, values[headerIndex]]));
    });
  };
  const clean = (value: string | undefined) => (value ?? "").trim();
  const warningCounts = new Map<string, number>();
  const addWarning = (message: string) => warningCounts.set(message, (warningCounts.get(message) ?? 0) + 1);
  const warnings = () => [...warningCounts].map(([message, count]) => `${message} (${count} rows)`);
  const fallbackText = (value: string | undefined, max: number, field: string, fallback = "Unassigned") => {
    const text = clean(value);
    if (!text) {
      addWarning(`${field} missing; using ${fallback}`);
      return fallback;
    }
    if (text.length > max) {
      addWarning(`${field} truncated to ${max} characters`);
      return text.slice(0, max);
    }
    return text;
  };
  const validDate = (value: string | undefined) => {
    const candidate = clean(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate) || candidate.startsWith("0000-")) return undefined;
    const date = new Date(`${candidate}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== candidate ? undefined : date;
  };

  try {
    const userRows = await parseCsv(usersPath, ["user", "pass", "status"]);
    const productRows = await parseCsv(productsPath, ["Invoice", "VIN", "Year", "Make", "Model"]);
    const preparedUsers = userRows.map((row, index) => {
      const username = clean(row.user);
      const password = row.pass ?? "";
      const status = clean(row.status).toLowerCase();
      const errors: string[] = [];
      if (!username || username.length > 50) errors.push("invalid username");
      if (!password || password.length > 200) errors.push("password outside supported login length");
      if (status !== "admin" && status !== "user") errors.push("unknown role status");
      return { rowNumber: index + 2, username, password, fullName: "Unassigned", role: status === "admin" ? "admin" as const : "agent" as const, errors };
    });
    const usernameCounts = new Map<string, number>();
    for (const row of preparedUsers) usernameCounts.set(row.username.toLowerCase(), (usernameCounts.get(row.username.toLowerCase()) ?? 0) + 1);
    for (const row of preparedUsers) if ((usernameCounts.get(row.username.toLowerCase()) ?? 0) > 1) row.errors.push("duplicate username after trimming/case folding");

    const preparedInvoices = productRows.map((row, index) => {
      const invoiceNumber = clean(row.Invoice);
      const sourceVin = clean(row.VIN).toUpperCase();
      const sourceYear = yearCorrections.get(invoiceNumber) ?? Number(clean(row.Year));
      const sourceOdometer = clean(row.Odometer);
      const parsedOdometer = Number(sourceOdometer);
      const errors: string[] = [];
      if (!invoiceNumber || invoiceNumber.length > 50) errors.push("invalid invoice number");
      const rowNumber = index + 2;
      const vin = /^[A-HJ-NPR-Z0-9]{17}$/.test(sourceVin) ? sourceVin : "UNASSIGNED";
      if (vin !== sourceVin) addWarning("Invalid or missing VIN; using UNASSIGNED");
      const year = Number.isInteger(sourceYear) && sourceYear >= 1886 && sourceYear <= 2100 ? sourceYear : 0;
      if (year !== sourceYear) addWarning("Invalid or missing year; using 0");
      const odometer = Number.isInteger(parsedOdometer) && parsedOdometer >= 0 ? parsedOdometer : 0;
      if (!sourceOdometer || odometer !== parsedOdometer) addWarning("Invalid or missing odometer; using 0");
      const saleDate = validDate(row.Sale_Date);
      const dateOfSale = validDate(row.DateOfSale);
      if (clean(row.Sale_Date) && !saleDate) addWarning("Invalid Sale_Date omitted");
      if (clean(row.DateOfSale) && !dateOfSale) addWarning("Invalid DateOfSale omitted");
      const ageDate = saleDate ?? dateOfSale;
      const textFields = {
        make: fallbackText(row.Make, 50, "Make"),
        model: fallbackText(row.Model, 50, "Model"),
        bodyStyle: fallbackText(row.BodyStyle, 30, "BodyStyle"),
        countryOfOrigin: fallbackText(row.CountryOfOrigin, 50, "CountryOfOrigin"),
        titleStatus: fallbackText(row.TitleStatus, 30, "TitleStatus"),
        damageHistory: fallbackText(row.DamageHistory, Number.MAX_SAFE_INTEGER, "DamageHistory"),
        vehicleStock: fallbackText(row.Vehicle_Stock, 50, "Vehicle_Stock"),
        vehiclePrice: fallbackText(row.Vehicle_Price, 50, "Vehicle_Price"),
        totalSales: fallbackText(row.Total_Sales, 50, "Total_Sales"),
        auctionSource: fallbackText(row.AuctionSource, 100, "AuctionSource"),
        buyerType: fallbackText(row.BuyerType, 20, "BuyerType"),
        buyerCompany: fallbackText(row.Buyer_Company, 100, "Buyer_Company"),
        buyerAddress: fallbackText(row.Buyer_Address, 200, "Buyer_Address"),
        buyerCity: fallbackText(row.Buyer_City, 100, "Buyer_City"),
        buyerRfc: fallbackText(row.Buyer_RFC, 20, "Buyer_RFC"),
        dataAnalyst: fallbackText(row.Data_Analyst, 255, "Data_Analyst"),
        sourceVerification: fallbackText(row.SourceVerification, 50, "SourceVerification"),
        verified: fallbackText(row.Verified, 10, "Verified", "No"),
      };
      return { rowNumber, invoiceNumber, vin, year, odometer, saleDate, dateOfSale, ageDate, textFields, row, errors };
    });

    const duplicateValues = (values: string[]) => new Set(values.filter((value, index) => values.indexOf(value) !== index));
    const duplicateInvoices = duplicateValues(preparedInvoices.map((row) => row.invoiceNumber));
    for (const row of preparedInvoices) {
      if (duplicateInvoices.has(row.invoiceNumber)) row.errors.push("duplicate invoice number");
    }

    let existingUsernames = new Set<string>();
    let existingInvoiceNumbers = new Set<string>();
    const userIds = new Map<string, mongoose.Types.ObjectId>();
    let expirationDays = defaultInvoiceExpirationDays;
    if (checkTarget) {
      await connectDb();
      expirationDays = await getInvoiceExpirationDays();
      const existingUsers = (await User.find({}, { username: 1 }).lean()) as { username: string; _id: mongoose.Types.ObjectId }[];
      existingUsernames = new Set(existingUsers.map((user) => user.username.toLowerCase()));
      for (const user of existingUsers) userIds.set(user.username.toLowerCase(), user._id);
      const existingInvoices = (await Invoice.find({}, { _id: 1 }).lean()) as { _id: string }[];
      existingInvoiceNumbers = new Set(existingInvoices.map((invoice) => invoice._id));
    }
    const skipped = [
      ...preparedUsers.flatMap((row) => row.errors.map((reason) => `users CSV row ${row.rowNumber}: ${reason}`)),
      ...preparedInvoices.flatMap((row) => row.errors.map((reason) => `products CSV row ${row.rowNumber}: ${reason}`)),
    ];
    for (const row of preparedUsers) {
      if (existingUsernames.has(row.username.toLowerCase())) skipped.push(`users CSV row ${row.rowNumber}: username already exists in target database`);
    }
    for (const row of preparedInvoices) {
      if (existingInvoiceNumbers.has(row.invoiceNumber)) skipped.push(`products CSV row ${row.rowNumber}: invoice number already exists in target database`);
    }
    const analystMapping = Object.fromEntries([...new Set(preparedInvoices.map((row) => clean(row.row.Data_Analyst)).filter(Boolean))]
      .sort()
      .map((analyst) => [analyst, analystMap.get(analyst) ?? null]));
    for (const [analyst, username] of Object.entries(analystMapping)) {
      if (!username) {
        const rowCount = preparedInvoices.filter((row) => clean(row.row.Data_Analyst) === analyst).length;
        warningCounts.set(`Analyst ${analyst} has no confirmed user mapping; creator remains unassigned`, rowCount);
      }
    }
    const report = {
      mode: apply ? "apply" : "dry-run",
      targetChecked: checkTarget,
      users: { sourceRows: preparedUsers.length, importable: preparedUsers.filter((row) => !row.errors.length && !existingUsernames.has(row.username.toLowerCase())).length, roles: Object.fromEntries(["admin", "user"].map((role) => [role, preparedUsers.filter((row) => clean(userRows.find((source) => clean(source.user) === row.username)?.status).toLowerCase() === role).length])) },
      invoices: { sourceRows: preparedInvoices.length, importable: preparedInvoices.filter((row) => !row.errors.length && !existingInvoiceNumbers.has(row.invoiceNumber)).length },
      analystMapping,
      warnings: warnings(),
      skipped,
    };
    const importTime = new Date();
    const expirationCutoff = invoiceExpirationCutoff(importTime, expirationDays);
    let importedUsers = 0;
    let importedInvoices = 0;
    const failures: string[] = [];
    if (apply) {
      for (const row of preparedUsers.filter((candidate) => !candidate.errors.length && !existingUsernames.has(candidate.username.toLowerCase()))) {
        try {
          const passwordHash = await argon2.hash(row.password, { type: argon2.argon2id });
          const created = await User.create({ username: row.username, passwordHash, fullName: row.fullName, role: row.role });
          userIds.set(row.username.toLowerCase(), created._id);
          importedUsers++;
        } catch (error) {
          failures.push(`users CSV row ${row.rowNumber}: ${error instanceof Error ? error.message : "database insert failed"}`);
        }
      }
      for (const row of preparedInvoices.filter((candidate) => !candidate.errors.length && !existingInvoiceNumbers.has(candidate.invoiceNumber))) {
        const source = row.row;
        const analyst = clean(source.Data_Analyst);
        const mappedUsername = analystMap.get(analyst);
        const createdByUserId = mappedUsername ? userIds.get(mappedUsername.toLowerCase()) : undefined;
        try {
          await Invoice.create({
            _id: row.invoiceNumber,
            ...(createdByUserId ? { createdByUserId } : {}),
            vin: row.vin,
            year: row.year,
            make: row.textFields.make,
            model: row.textFields.model,
            bodyStyle: row.textFields.bodyStyle,
            countryOfOrigin: row.textFields.countryOfOrigin,
            odometer: row.odometer,
            titleStatus: row.textFields.titleStatus,
            damageHistory: row.textFields.damageHistory,
            vehicleStock: row.textFields.vehicleStock,
            ...(row.saleDate ? { saleDate: row.saleDate } : {}),
            ...(row.dateOfSale ? { dateOfSale: row.dateOfSale } : {}),
            vehiclePrice: row.textFields.vehiclePrice,
            totalSales: row.textFields.totalSales,
            auctionSource: row.textFields.auctionSource,
            buyerType: row.textFields.buyerType,
            buyerCompany: row.textFields.buyerCompany,
            buyerAddress: row.textFields.buyerAddress,
            buyerCity: row.textFields.buyerCity,
            buyerRfc: row.textFields.buyerRfc,
            dataAnalyst: row.textFields.dataAnalyst,
            sourceVerification: row.textFields.sourceVerification,
            verified: row.textFields.verified,
            reportDate: row.ageDate && row.ageDate <= expirationCutoff ? row.ageDate : importTime,
          });
          importedInvoices++;
        } catch (error) {
          failures.push(`products CSV row ${row.rowNumber}: ${error instanceof Error ? error.message : "database insert failed"}`);
        }
      }
    }
    report.warnings = warnings();
    report.warnings.push("Passwords are converted to Argon2id hashes without changing their values; plaintext passwords are never printed.");
    report.skipped.push(...failures);
    console.log(JSON.stringify({ ...report, ...(apply ? { imported: { users: importedUsers, invoices: importedInvoices }, reportDate: importTime.toISOString() } : {}) }, null, 2));
    if (skipped.length || failures.length) process.exitCode = 1;
  } catch (error) {
    console.error("Live CSV import failed:", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
