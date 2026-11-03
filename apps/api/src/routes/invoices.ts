import type { FastifyInstance } from "fastify";
import { count, like, or, sql } from "drizzle-orm";
import { createInvoiceSchema } from "@dataaxcess/shared";
import { db } from "../db/index.js";
import { invoices } from "../db/schema.js";
import { requireAuth } from "./auth.js";

type InvoiceQuery = { q?: string; page?: string; pageSize?: string };

export async function registerInvoiceRoutes(app: FastifyInstance) {
  app.post<{ Body: unknown }>("/api/invoices", {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const parsed = createInvoiceSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Check the required fields and try again." });

    const input = parsed.data;
    try {
      await db.insert(invoices).values({
        invoiceNumber: input.invoiceNumber,
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
      const dbError = error as { code?: string; errno?: number };
      if (dbError.code === "ER_DUP_ENTRY" || dbError.errno === 1062) {
        return reply.code(409).send({ error: "An invoice with this invoice number or VIN already exists." });
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
