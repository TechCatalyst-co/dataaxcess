import type { FastifyInstance } from "fastify";
import { count, desc, eq, like, or, sql } from "drizzle-orm";
import { createInvoiceSchema } from "@dataaxcess/shared";
import { db } from "../db/index.js";
import { invoices, sessions, users } from "../db/schema.js";
import { requireAuth } from "./auth.js";

type InvoiceQuery = { q?: string; page?: string; pageSize?: string };

export async function registerInvoiceRoutes(app: FastifyInstance) {
  app.get("/api/compliance/audit", { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.authUser!.id;
    const [user] = await db.select({ id: users.id, username: users.username, fullName: users.fullName, role: users.role })
      .from(users).where(eq(users.id, userId)).limit(1);
    const [session] = request.sessionId
      ? await db.select({ createdAt: sessions.createdAt, lastActivityAt: sessions.lastActivityAt, expiresAt: sessions.expiresAt, endedAt: sessions.endedAt })
        .from(sessions).where(eq(sessions.id, request.sessionId)).limit(1)
      : [];
    const [lastVin] = await db.select({
      vin: invoices.vin,
      year: invoices.year,
      make: invoices.make,
      model: invoices.model,
      submittedAt: sql<string>`DATE_FORMAT(${invoices.reportDate}, '%Y-%m-%d %H:%i:%s')`,
    })
      .from(invoices).where(eq(invoices.createdByUserId, userId)).orderBy(desc(invoices.reportDate)).limit(1);
    const [invoiceCounts] = await db.select({
      total: count(),
      verified: sql<number>`COALESCE(SUM(CASE WHEN LOWER(${invoices.verified}) = 'yes' THEN 1 ELSE 0 END), 0)`,
      createdThisMonth: sql<number>`COALESCE(SUM(CASE WHEN ${invoices.reportDate} >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') THEN 1 ELSE 0 END), 0)`,
    }).from(invoices)
      .where(eq(invoices.createdByUserId, userId));
    if (!user) return reply.code(404).send({ error: "User not found" });
    return {
      user,
      session: session ? {
        loginAt: session.createdAt,
        lastActivityAt: session.lastActivityAt,
        expiresAt: session.expiresAt,
        endedAt: session.endedAt,
        status: session.endedAt ? "ended" : session.expiresAt > new Date() ? "active" : "expired",
      } : null,
      vinActivity: {
        lastVin: lastVin?.vin ?? null,
        lastVehicle: lastVin ? { year: lastVin.year, make: lastVin.make, model: lastVin.model } : null,
        lastSubmittedAt: lastVin?.submittedAt ?? null,
        submittedCount: Number(invoiceCounts.total),
      },
      invoiceActivity: {
        createdThisMonth: Number(invoiceCounts.createdThisMonth),
        pending: Number(invoiceCounts.total) - Number(invoiceCounts.verified),
        verified: Number(invoiceCounts.verified),
        verificationRate: Number(invoiceCounts.total) === 0
          ? null
          : Math.round((Number(invoiceCounts.verified) / Number(invoiceCounts.total)) * 100),
      },
    };
  });

  app.post<{ Body: unknown }>("/api/invoices", {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const parsed = createInvoiceSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Check the required fields and try again." });

    const input = parsed.data;
    try {
      await db.insert(invoices).values({
        invoiceNumber: input.invoiceNumber,
        createdByUserId: request.authUser!.id,
        vin: input.vin,
        year: input.year,
        make: input.make,
        model: input.model,
        buyerCompany: input.buyerCompany || null,
        buyerRfc: input.buyerRfc || null,
        buyerAddress: input.buyerAddress || null,
        buyerCity: input.buyerCity || null,
        saleDate: input.saleDate ?? null,
        dateOfSale: input.saleDate ?? null,
        totalSales: input.totalSales ?? null,
        vehiclePrice: input.totalSales ?? null,
        odometer: 0,
        titleStatus: "Unknown",
        buyerType: "Unknown",
        sourceVerification: "Pending",
        dataAnalyst: input.dataAnalyst || null,
        verified: "No",
      });
    } catch (error) {
      const err = error as any;
      const messages = [
        err?.message,
        err?.cause?.message,
        err?.causedBy?.message,
        err?.sqlMessage,
        String(err),
      ].filter(Boolean);
      const combined = messages.join(" ").toLowerCase();
      if (combined.includes("duplicate entry") && combined.includes("primary")) {
        return reply.code(409).send({ error: "An invoice with this invoice number already exists." });
      }
      throw error;
    }

    return reply.code(201).send({ invoiceNumber: input.invoiceNumber });
  });

  app.get<{ Querystring: InvoiceQuery }>("/api/invoices", {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const query = request.query.q?.trim().slice(0, 100) ?? "";
    const page = Number(request.query.page ?? 1);
    const pageSize = Number(request.query.pageSize ?? 20);
    if (!Number.isInteger(page) || page < 1 || page > 1_000_000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return reply.code(400).send({ error: "Invalid pagination parameters" });
    }

    const where = query
      ? or(
        like(invoices.invoiceNumber, `%${query}%`),
        like(invoices.vin, `%${query}%`),
        like(invoices.make, `%${query}%`),
        like(invoices.model, `%${query}%`),
        like(invoices.buyerCompany, `%${query}%`),
      )
      : undefined;

    const [{ total }] = await db.select({ total: count() }).from(invoices).where(where);
    const rows = await db.select({
      invoiceNumber: invoices.invoiceNumber,
      vin: invoices.vin,
      year: invoices.year,
      make: invoices.make,
      model: invoices.model,
      buyerCompany: invoices.buyerCompany,
      saleDate: invoices.saleDate,
      totalSales: invoices.totalSales,
      verified: invoices.verified,
    }).from(invoices)
      .where(where)
      .orderBy(sql`${invoices.saleDate} DESC, ${invoices.invoiceNumber} DESC`)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { items: rows, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  });
}
