import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import mongoose from "mongoose";
import { createInvoiceSchema, updateInvoiceStatusSchema } from "@dataaxcess/shared";
import { AppSetting, Invoice, Session, User } from "../db/schema.js";
import { getInvoiceExpirationDays, invoiceExpirationCutoff, invoiceExpirationDate } from "../db/invoice-archive.js";
import { requireAuth, requireRole, requireRoles } from "./auth.js";

type InvoiceQuery = { q?: string; page?: string; pageSize?: string };
type DashboardQuery = { fromDate?: string; toDate?: string };

const monthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

export async function registerInvoiceRoutes(app: FastifyInstance) {
  app.get<{ Querystring: DashboardQuery }>("/api/invoices/analytics/summary", {
    preHandler: requireRoles(["admin", "agent"]),
  }, async (request, reply) => {
    const { fromDate, toDate } = request.query;
    const parseDate = (value: string | undefined) => {
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
      const date = new Date(`${value}T00:00:00.000Z`);
      return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : date;
    };
    const from = parseDate(fromDate);
    const to = parseDate(toDate);
    if (!from || !to || from > to) {
      return reply.code(400).send({ error: "Provide a valid date range using YYYY-MM-DD values." });
    }
    const toExclusive = new Date(to);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    const [usersCount, [dashboard]] = await Promise.all([
      User.countDocuments({ deletedAt: null }),
      Invoice.aggregate<{
        summary: { totalClearanceValueUsd: number; totalInvoices: number; verifiedInvoices: number }[];
        trend: { _id: string; count: number; latestSaleDate: Date }[];
        activity: { _id: string; saleDate?: Date; year: number; make: string; model: string; buyerCompany?: string; totalSales?: string; verified?: string }[];
      }>([
        {
          $facet: {
            summary: [{
              $group: {
                _id: null,
                totalClearanceValueUsd: {
                  $sum: { $convert: { input: "$totalSales", to: "double", onError: 0, onNull: 0 } },
                },
                totalInvoices: { $sum: 1 },
                verifiedInvoices: {
                  $sum: {
                    $cond: [
                      { $eq: [{ $toLower: { $convert: { input: "$verified", to: "string", onError: "", onNull: "" } } }, "yes"] },
                      1,
                      0,
                    ],
                  },
                },
              },
            }],
            trend: [
              { $match: { saleDate: { $type: "date", $gte: from, $lt: toExclusive } } },
              {
                $group: {
                  _id: { $dateToString: { format: "%Y-%m", date: "$saleDate", timezone: "UTC" } },
                  count: { $sum: 1 },
                  latestSaleDate: { $max: "$saleDate" },
                },
              },
              { $sort: { _id: 1 } },
            ],
            activity: [
              { $sort: { saleDate: -1, _id: -1 } },
              { $limit: 5 },
              { $project: { _id: 1, saleDate: 1, year: 1, make: 1, model: 1, buyerCompany: 1, totalSales: 1, verified: 1 } },
            ],
          },
        },
      ]),
    ]);
    const summary = dashboard?.summary[0];
    const totalInvoices = summary?.totalInvoices ?? 0;
    const verifiedInvoices = summary?.verifiedInvoices ?? 0;
    const clearanceAccuracyPercentage = totalInvoices === 0 ? 0 : Math.round((verifiedInvoices / totalInvoices) * 1000) / 10;
    const latestMonth = dashboard?.trend.reduce((latest, point) => point.latestSaleDate > latest.date ? { key: point._id, date: point.latestSaleDate } : latest, { key: "", date: new Date(0) }).key;
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const accuracyItems = [
      { id: "anam-verified", label: "ANAM Customs Verified Clearance", percentage: clearanceAccuracyPercentage, barColor: "green" },
      { id: "pending-approvals", label: "Pending Customs Approvals", percentage: totalInvoices === 0 ? 0 : Math.round(((totalInvoices - verifiedInvoices) / totalInvoices) * 1000) / 10, barColor: "orange" },
      { id: "compliance-rate", label: "Compliance Verification Rate", percentage: clearanceAccuracyPercentage, barColor: "blue" },
    ].map((item) => ({ ...item, targetLabel: `${item.percentage.toFixed(1)}%` }));
    return {
      registeredUsers: usersCount,
      totalClearanceValueUsd: summary?.totalClearanceValueUsd ?? 0,
      verifiedInvoices,
      pendingInvoices: totalInvoices - verifiedInvoices,
      clearanceAccuracyPercentage,
      trendData: (dashboard?.trend ?? []).map((point) => ({
        month: monthNames[Number(point._id.slice(5, 7)) - 1] ?? "",
        value: point.count,
        isActive: point._id === latestMonth,
      })),
      accuracy: { statusBadge: clearanceAccuracyPercentage >= 95 ? "TARGET MET" : "TARGET NOT MET", items: accuracyItems },
      recentActivity: (dashboard?.activity ?? []).map((row) => ({
        invoiceId: row._id,
        date: row.saleDate instanceof Date ? row.saleDate.toISOString().slice(0, 10) : "",
        vehicleYear: row.year,
        vehicleMake: row.make,
        vehicleModel: row.model,
        buyer: row.buyerCompany ?? "",
        amount: Number(row.totalSales ?? 0),
        status: row.verified?.trim().toLowerCase() === "yes" ? "VERIFIED" : "PENDING",
      })),
    };
  });

  app.get("/api/compliance/audit", { preHandler: requireRoles(["admin", "agent"]) }, async (request, reply) => {
    const userId = request.authUser!.id;
    const userRaw = await User.findOne({ _id: new mongoose.Types.ObjectId(userId) })
      .lean<{ _id: { toHexString: () => string }; username: string; fullName: string; role: string }>();
    if (!userRaw) return reply.code(404).send({ error: "User not found" });
    const user = { id: userRaw._id.toHexString(), username: userRaw.username, fullName: userRaw.fullName, role: userRaw.role };
    const session: any = request.sessionId
      ? await Session.findOne({ _id: request.sessionId }).lean()
      : null;
    const lastVin: any = await Invoice.findOne({ createdByUserId: new mongoose.Types.ObjectId(userId) })
      .sort({ reportDate: -1 })
      .lean<{ vin: string; year: number; make: string; model: string; reportDate: Date }>();
    const [invoiceCounts] = await Invoice.aggregate([
      { $match: { createdByUserId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          verified: {
            $sum: { $cond: [{ $eq: [{ $toLower: "$verified" }, "yes"] }, 1, 0] },
          },
          createdThisMonth: {
            $sum: { $cond: [{ $gte: ["$reportDate", monthStart()] }, 1, 0] },
          },
        },
      },
    ]);
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
        lastSubmittedAt: lastVin?.reportDate ?? null,
        submittedCount: Number(invoiceCounts?.total ?? 0),
      },
      invoiceActivity: {
        createdThisMonth: Number(invoiceCounts?.createdThisMonth ?? 0),
        pending: Number(invoiceCounts?.total ?? 0) - Number(invoiceCounts?.verified ?? 0),
        verified: Number(invoiceCounts?.verified ?? 0),
        verificationRate: Number(invoiceCounts?.total ?? 0) === 0
          ? null
          : Math.round((Number(invoiceCounts?.verified ?? 0) / Number(invoiceCounts?.total ?? 0)) * 100),
      },
    };
  });

  app.post<{ Body: unknown }>('/api/invoices', { preHandler: requireRoles(["admin", "agent"]) }, async (request, reply) => {
    const parsed = createInvoiceSchema.safeParse(request.body);
    if (!parsed.success) {
      console.log(JSON.stringify({
        level: "warn",
        workflow: "invoice_create",
        step: "validation",
        message: "Zod validation failed",
        errors: parsed.error?.flatten().fieldErrors,
      }));
      return reply.code(400).send({ error: "Check the required fields and try again." });
    }

    const input = parsed.data;
    const authUserId = request.authUser!.id;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(authUserId);

    console.log(JSON.stringify({
      level: "info",
      workflow: "invoice_create",
      step: "input",
      invoiceNumber: input.invoiceNumber,
      authUserId,
      isValidObjectId,
      hasVin: Boolean(input.vin),
      totalSales: input.totalSales,
    }));

    if (!isValidObjectId) {
      console.log(JSON.stringify({
        level: "error",
        workflow: "invoice_create",
        step: "objectid_guard",
        message: "authUser.id is not a valid ObjectId hex string",
        authUserId,
      }));
      return reply.code(400).send({ error: "Invalid user session." });
    }

    try {
      const reportDate = new Date();
      const createInput = {
        _id: input.invoiceNumber,
        createdByUserId: new mongoose.Types.ObjectId(authUserId),
        reportDate,
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
      };

      console.log(JSON.stringify({
        level: "debug",
        workflow: "invoice_create",
        step: "db_create",
        createdByUserId: createInput.createdByUserId,
      }));

      await Invoice.create(createInput);

      console.log(JSON.stringify({
        level: "info",
        workflow: "invoice_create",
        step: "success",
        invoiceNumber: input.invoiceNumber,
        createdByUserId: authUserId,
      }));
    } catch (error) {
      const err = error as any;
      const messages = [
        err?.message,
        err?.cause?.message,
        err?.causedBy?.message,
        String(err),
      ].filter(Boolean);
      const combined = messages.join(" ").toLowerCase();

      console.log(JSON.stringify({
        level: "error",
        workflow: "invoice_create",
        step: "db_create_failed",
        invoiceNumber: input.invoiceNumber,
        authUserId,
        errorCode: err?.code,
        errorMessage: err?.message,
        combined,
      }));

      if (err?.code === 11000 || combined.includes("duplicate key") || combined.includes("E11000")) {
        return reply.code(409).send({ error: "An invoice with this invoice number already exists." });
      }
      throw error;
    }

    return reply.code(201).send({ invoiceNumber: input.invoiceNumber });
  });

  app.put<{ Body: unknown }>('/api/invoices/status', {
    preHandler: async (request, reply) => {
      if (!request.authUser) return reply.code(401).send({ error: 'Authentication required' });
      if (request.authUser.role !== 'admin' && request.authUser.role !== 'agent') {
        return reply.code(403).send({ error: 'Insufficient permissions' });
      }
    },
  }, async (request, reply) => {
    const parsed = updateInvoiceStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Provide a valid invoice number and status." });
    }

    const update = {
      $set: { verified: parsed.data.status === "verified" ? "Yes" : "No" },
      $push: {
        verificationHistory: {
          userId: new mongoose.Types.ObjectId(request.authUser!.id),
          verifiedAt: new Date(),
          source: "ledger",
          status: parsed.data.status,
        },
      },
    };
    const result = await Invoice.updateOne({ _id: parsed.data.invoiceNumber }, update);
    if (result.matchedCount === 0) return reply.code(404).send({ error: "Invoice not found." });

    return { invoiceNumber: parsed.data.invoiceNumber, status: parsed.data.status };
  });

  app.get<{ Params: { invoiceNumber: string } }>("/api/invoices/:invoiceNumber", {
    preHandler: requireRoles(["admin", "agent"]),
  }, async (request, reply) => {
    const invoice: any = await Invoice.findById(request.params.invoiceNumber)
      .select("_id vin year make model buyerCompany buyerRfc buyerAddress buyerCity saleDate totalSales dataAnalyst verified verificationHistory")
      .populate({ path: "verificationHistory.userId", select: "fullName username role" })
      .lean();
    if (!invoice) return reply.code(404).send({ error: "Invoice not found." });

    return {
      invoiceNumber: invoice._id,
      vin: invoice.vin,
      year: invoice.year,
      make: invoice.make,
      model: invoice.model,
      buyerCompany: invoice.buyerCompany ?? null,
      buyerRfc: invoice.buyerRfc ?? null,
      buyerAddress: invoice.buyerAddress ?? null,
      buyerCity: invoice.buyerCity ?? null,
      saleDate: invoice.saleDate ?? null,
      totalSales: invoice.totalSales == null ? null : String(invoice.totalSales),
      dataAnalyst: invoice.dataAnalyst ?? null,
      verified: invoice.verified ?? "No",
      verificationHistory: (invoice.verificationHistory ?? []).map((event: any) => ({
        verifiedAt: event.verifiedAt,
        source: event.source,
        status: event.status ?? "verified",
        user: event.userId ? {
          fullName: event.userId.fullName,
          username: event.userId.username,
          role: event.userId.role,
        } : null,
      })),
    };
  });

  app.get<{ Querystring: InvoiceQuery }>("/api/invoices/archived", {
    preHandler: requireRole("admin"),
  }, async (request, reply) => {
    const expirationDays = await getInvoiceExpirationDays();
    const cutoff = invoiceExpirationCutoff(new Date(), expirationDays);
    return listInvoices(request, reply, { reportDate: { $lte: cutoff } }, true, expirationDays);
  });

  app.put<{ Body: unknown }>("/api/invoices/expiration-threshold", {
    preHandler: requireRole("admin"),
  }, async (request, reply) => {
    const body = request.body as { days?: unknown } | null;
    const days = body?.days;
    if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 3650) {
      return reply.code(400).send({ error: "Expiration period must be between 1 and 3650 days." });
    }

    await AppSetting.updateOne(
      { _id: "invoiceExpirationDays" },
      { $set: { value: days, updatedAt: new Date() } },
      { upsert: true },
    );
    return { expirationThresholdDays: days };
  });

  app.get<{ Querystring: InvoiceQuery }>("/api/invoices", {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const expirationDays = await getInvoiceExpirationDays();
    const cutoff = invoiceExpirationCutoff(new Date(), expirationDays);
    return listInvoices(request, reply, { reportDate: { $gt: cutoff } }, false, expirationDays);
  });
}

async function listInvoices(
  request: FastifyRequest<{ Querystring: InvoiceQuery }>,
  reply: FastifyReply,
  lifecycleFilter: Record<string, unknown>,
  includeDates: boolean,
  expirationDays: number,
) {
    const query = request.query.q?.trim().slice(0, 100) ?? "";
    const page = Number(request.query.page ?? 1);
    const pageSize = Number(request.query.pageSize ?? 20);
    if (!Number.isInteger(page) || page < 1 || page > 1_000_000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return reply.code(400).send({ error: "Invalid pagination parameters" });
    }

    const where: Record<string, unknown> = { ...lifecycleFilter };
    if (query) {
      const regex = { $regex: query, $options: "i" };
      where.$or = [
        { _id: regex },
        { vin: regex },
        { make: regex },
        { model: regex },
        { buyerCompany: regex },
      ];
    }

    const total = await Invoice.countDocuments(where);
    const rows = await Invoice.find(where)
      .select("_id vin year make model buyerCompany saleDate totalSales verified reportDate")
      .sort({ saleDate: -1, _id: -1 })
      .limit(pageSize)
      .skip((page - 1) * pageSize)
      .lean();

    return {
      items: rows.map((row: any) => {
        const reportDate = new Date(row.reportDate);
        return {
          invoiceNumber: row._id,
          vin: row.vin,
          year: row.year,
          make: row.make,
          model: row.model,
          buyerCompany: row.buyerCompany,
          saleDate: row.saleDate instanceof Date
            ? row.saleDate.toISOString().slice(0, 10)
            : row.saleDate == null ? null : String(row.saleDate).slice(0, 10),
          totalSales: row.totalSales == null ? null : String(row.totalSales),
          verified: row.verified,
          ...(includeDates ? {
            createdAt: reportDate.toISOString(),
            expiresAt: invoiceExpirationDate(reportDate, expirationDays).toISOString(),
          } : {}),
        };
      }),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      ...(includeDates ? { expirationThresholdDays: expirationDays } : {}),
    };
}
