/**
 * MongoDB Data Integrity Validator — DataAxcess
 *
 * Read-only diagnostic script that connects to MongoDB via Mongoose and
 * audits the `users`, `sessions`, and `invoices` collections for:
 *   - Per-field type mismatches vs the expected Mongoose schema
 * *   - Null/missing counts on required fields
 *   - Referential integrity (Session.userId → User, Invoice.createdByUserId → User)
 *   - ObjectId validity of id fields used in new mongoose.Types.ObjectId() casts
 *   - Virtuals (id on User, invoiceNumber on Invoice) resolving correctly
 *
 * Usage:
 *   npx tsx scripts/mongodb-validate.ts \
 *     --uri mongodb://localhost:27017/dataaxcess
 *
 * Environment variable fallback: MONGODB_URI
 *
 * Exit codes:
 *   0 — no integrity issues
 *   1 — one or more integrity issues found
 *   2 — configuration / connection error
 */

import mongoose from "mongoose";
import { User, Session, Invoice } from "../src/db/schema.js";

type CliArgs = {
  uri: string;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    uri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/dataaxcess",
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--uri") {
      args.uri = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
Usage: tsx scripts/mongodb-validate.ts [--uri <mongodb_uri>]

Options:
  --uri VALUE   MongoDB connection URI (default: MONGODB_URI env or mongodb://localhost:27017/dataaxcess)
  --help, -h    Show this help
`);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
    i++;
  }

  return args;
}

type FieldAudit = {
  field: string;
  total: number;
  nullCount: number;
  missingCount: number;
  typeHistogram: Record<string, number>;
  unexpectedTypes: string[];
};

type ReferentialIssue = {
  collection: string;
  field: string;
  localValue: string | null;
  message: string;
};

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Date) return "date";
  if (value instanceof mongoose.Types.ObjectId) return "objectid";
  if (value instanceof mongoose.Types.Decimal128) return "decimal128";
  if (typeof value === "object") return "object";
  return typeof value;
}

async function auditCollection(
  model: mongoose.Model<any>,
  collectionName: string,
  expectedFields: Record<string, string>,
  requiredFields: ReadonlySet<string>,
): Promise<FieldAudit[]> {
  const audits: FieldAudit[] = [];
  const docs = await model.find().lean();

  for (const field of Object.keys(expectedFields)) {
    const typeHistogram: Record<string, number> = {};
    let nullCount = 0;
    let missingCount = 0;
    let total = 0;

    for (const doc of docs) {
      total += 1;
      const value = (doc as any)[field];
      const t = typeOf(value);
      typeHistogram[t] = (typeHistogram[t] ?? 0) + 1;
      if (value === null) nullCount += 1;
      if (value === undefined) missingCount += 1;
    }

    const expectedTypes = expectedFields[field]!.split("|");
    const unexpectedTypes: string[] = [];
    for (const [t, count] of Object.entries(typeHistogram)) {
      if (t === "null" || t === "undefined") continue;
      if (!expectedTypes.includes(t)) {
        unexpectedTypes.push(`${t} (${count} docs)`);
      }
    }

    audits.push({
      field,
      total,
      nullCount,
      missingCount,
      typeHistogram,
      unexpectedTypes,
    });
  }

  return audits;
}

async function checkReferentialIntegrity(): Promise<ReferentialIssue[]> {
  const issues: ReferentialIssue[] = [];

  // Session.userId -> User
  const sessions = await Session.find({ userId: { $exists: true } }).lean();
  for (const s of sessions) {
    const userId = (s as any).userId;
    if (!userId) {
      issues.push({
        collection: "sessions",
        field: "userId",
        localValue: null,
        message: "userId is null/missing",
      });
      continue;
    }
    const userIdStr = userId instanceof mongoose.Types.ObjectId ? userId.toHexString() : String(userId);
    if (!mongoose.Types.ObjectId.isValid(userIdStr)) {
      issues.push({
        collection: "sessions",
        field: "userId",
        localValue: userIdStr,
        message: "userId is not a valid ObjectId hex string",
      });
      continue;
    }
    const user = await User.findOne({ _id: new mongoose.Types.ObjectId(userIdStr) }).lean();
    if (!user) {
      issues.push({
        collection: "sessions",
        field: "userId",
        localValue: userIdStr,
        message: "references a non-existent User",
      });
    }
  }

  // Invoice.createdByUserId -> User (non-null only)
  const invoices = await Invoice.find({ createdByUserId: { $exists: true, $ne: null } }).lean();
  for (const inv of invoices) {
    const createdByUserId = (inv as any).createdByUserId;
    if (!createdByUserId) continue;
    const cbidStr = createdByUserId instanceof mongoose.Types.ObjectId ? createdByUserId.toHexString() : String(createdByUserId);
    if (!mongoose.Types.ObjectId.isValid(cbidStr)) {
      issues.push({
        collection: "invoices",
        field: "createdByUserId",
        localValue: cbidStr,
        message: "createdByUserId is not a valid ObjectId hex string",
      });
      continue;
    }
    const user = await User.findOne({ _id: new mongoose.Types.ObjectId(cbidStr) }).lean();
    if (!user) {
      issues.push({
        collection: "invoices",
        field: "createdByUserId",
        localValue: cbidStr,
        message: "references a non-existent User",
      });
    }
  }

  return issues;
}

async function checkVirtuals(): Promise<ReferentialIssue[]> {
  const issues: ReferentialIssue[] = [];

  // User.id virtual
  const users = await User.find().lean();
  for (const u of users) {
    const doc = u as any;
    const id = doc._id;
    if (!mongoose.Types.ObjectId.isValid(String(id))) {
      issues.push({
        collection: "users",
        field: "_id",
        localValue: String(id),
        message: "User _id is not a valid ObjectId; id virtual will not resolve",
      });
    }
  }

  // Invoice.invoiceNumber virtual (should be _id string)
  const invs = await Invoice.find().lean();
  for (const inv of invs) {
    const doc = inv as any;
    const id = doc._id;
    if (typeof id !== "string") {
      issues.push({
        collection: "invoices",
        field: "_id",
        localValue: typeof id,
        message: "Invoice _id is not a string natural key; invoiceNumber virtual may not resolve",
      });
    }
  }

  return issues;
}

function formatHistogram(h: Record<string, number>): string {
  return Object.entries(h)
    .map(([t, c]) => `${t}:${c}`)
    .join(", ");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  let hadIssues = false;

  try {
    await mongoose.connect(args.uri);

    console.log("=".repeat(70));
    console.log("MONGODB DATA INTEGRITY AUDIT — DataAxcess");
    console.log("=".repeat(70));
    console.log(`URI: ${args.uri}`);
    console.log("");

    // --- User collection audit ---
    console.log("-".repeat(70));
    console.log("Collection: users");
    const userExpected = {
      _id: "objectid",
      username: "string",
      passwordHash: "string",
      fullName: "string",
      role: "string",
      createdAt: "date",
      updatedAt: "date",
      failedLoginAttempts: "number",
      lockedUntil: "date",
      deletedAt: "date",
    };
    const userRequired = new Set([
      "_id", "username", "passwordHash", "fullName", "role", "createdAt", "updatedAt", "failedLoginAttempts",
    ]);
    const userAudits = await auditCollection(User, "users", userExpected, userRequired);
    for (const a of userAudits) {
      const requiredMissing = userRequired.has(a.field) && (a.nullCount > 0 || a.missingCount > 0);
      const status = a.unexpectedTypes.length > 0 || requiredMissing ? "ISSUE" : "ok";
      if (status === "ISSUE") hadIssues = true;
      console.log(
        `  [${status}] ${a.field} | total=${a.total} null=${a.nullCount} missing=${a.missingCount} | types=[${formatHistogram(a.typeHistogram)}]`,
      );
      if (a.unexpectedTypes.length > 0) {
        console.log(`      unexpected: ${a.unexpectedTypes.join("; ")}`);
      }
    }

    // --- Session collection audit ---
    console.log("-".repeat(70));
    console.log("Collection: sessions");
    const sessionExpected = {
      _id: "string",
      userId: "objectid",
      expiresAt: "date",
      createdAt: "date",
      lastActivityAt: "date",
      endedAt: "date",
    };
    const sessionRequired = new Set(["_id", "userId", "expiresAt", "createdAt", "lastActivityAt"]);
    const sessionAudits = await auditCollection(Session, "sessions", sessionExpected, sessionRequired);
    for (const a of sessionAudits) {
      const requiredMissing = sessionRequired.has(a.field) && (a.nullCount > 0 || a.missingCount > 0);
      const status = a.unexpectedTypes.length > 0 || requiredMissing ? "ISSUE" : "ok";
      if (status === "ISSUE") hadIssues = true;
      console.log(
        `  [${status}] ${a.field} | total=${a.total} null=${a.nullCount} missing=${a.missingCount} | types=[${formatHistogram(a.typeHistogram)}]`,
      );
      if (a.unexpectedTypes.length > 0) {
        console.log(`      unexpected: ${a.unexpectedTypes.join("; ")}`);
      }
    }

    // --- Invoice collection audit ---
    console.log("-".repeat(70));
    console.log("Collection: invoices");
    const invoiceExpected = {
      _id: "string",
      createdByUserId: "objectid",
      vin: "string",
      vehicleStock: "string",
      year: "number",
      make: "string",
      model: "string",
      bodyStyle: "string",
      countryOfOrigin: "string",
      odometer: "number",
      titleStatus: "string",
      damageHistory: "string",
      saleDate: "date",
      dateOfSale: "date",
      vehiclePrice: "string|decimal128",
      totalSales: "string|decimal128",
      auctionSource: "string",
      buyerType: "string",
      buyerCompany: "string",
      buyerAddress: "string",
      buyerCity: "string",
      buyerRfc: "string",
      dataAnalyst: "string",
      sourceVerification: "string",
      verified: "string",
      reportDate: "date",
    };
    const invoiceRequired = new Set(["_id", "vin", "year", "make", "model", "reportDate"]);
    const invoiceAudits = await auditCollection(Invoice, "invoices", invoiceExpected, invoiceRequired);
    for (const a of invoiceAudits) {
      const requiredMissing = invoiceRequired.has(a.field) && (a.nullCount > 0 || a.missingCount > 0);
      const status = a.unexpectedTypes.length > 0 || requiredMissing ? "ISSUE" : "ok";
      if (status === "ISSUE") hadIssues = true;
      console.log(
        `  [${status}] ${a.field} | total=${a.total} null=${a.nullCount} missing=${a.missingCount} | types=[${formatHistogram(a.typeHistogram)}]`,
      );
      if (a.unexpectedTypes.length > 0) {
        console.log(`      unexpected: ${a.unexpectedTypes.join("; ")}`);
      }
    }

    // --- Referential integrity ---
    console.log("-".repeat(70));
    console.log("Referential integrity:");
    const refIssues = await checkReferentialIntegrity();
    if (refIssues.length > 0) {
      hadIssues = true;
      for (const issue of refIssues) {
        console.log(`  [ISSUE] ${issue.collection}.${issue.field}: ${issue.message} (value=${issue.localValue})`);
      }
    } else {
      console.log("  [ok] All references resolve correctly.");
    }

    // --- Virtuals ---
    console.log("-".repeat(70));
    console.log("Virtual resolution:");
    const virtIssues = await checkVirtuals();
    if (virtIssues.length > 0) {
      hadIssues = true;
      for (const issue of virtIssues) {
        console.log(`  [ISSUE] ${issue.collection}.${issue.field}: ${issue.message} (value=${issue.localValue})`);
      }
    } else {
      console.log("  [ok] All virtuals resolve correctly.");
    }

    console.log("=".repeat(70));
    console.log(hadIssues ? "AUDIT FAILED — Integrity issues detected." : "AUDIT PASSED — No integrity issues.");
    console.log("=".repeat(70));

    process.exit(hadIssues ? 1 : 0);
  } catch (error) {
    console.error("Audit failed:", error instanceof Error ? error.message : String(error));
    process.exit(2);
  } finally {
    await mongoose.disconnect();
  }
}

main();
