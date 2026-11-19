import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { XMLBuilder } from "fast-xml-parser";
import mongoose from "mongoose";
import { vinSchema } from "@dataaxcess/shared";
import { getInvoiceExpirationDays, invoiceExpirationCutoff } from "../db/invoice-archive.js";
import { User, Invoice } from "../db/schema.js";

type SalesQuery = { vin?: string; format?: string; user?: string; password?: string };
type SalesBody = { vin?: string; format?: string; user?: string; pass?: string; password?: string };

const basicAuthHeader = (request: FastifyRequest) => request.headers.authorization as string | undefined;

const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  format: false,
  suppressEmptyNode: true,
});

function credentialsFrom(request: FastifyRequest, body: SalesBody) {
  const authorization = basicAuthHeader(request);
  if (authorization?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator > 0) return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
    } catch { /* Invalid Basic Auth is handled as unauthorized below. */ }
  }
  const form = request.body instanceof URLSearchParams
    ? Object.fromEntries(request.body.entries()) as SalesBody
    : body;
  return { username: form.user, password: form.pass ?? form.password };
}

export async function registerSalesApiRoutes(app: FastifyInstance) {
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
    done(null, new URLSearchParams(body as string));
  });

  const handler = async (
    request: FastifyRequest<{ Querystring: SalesQuery; Body: SalesBody }>,
    reply: FastifyReply,
  ) => {
      const body = (request.body ?? {}) as SalesBody;
      const query = request.query;
      const params = request.method === "GET"
        ? query
        : request.body instanceof URLSearchParams ? Object.fromEntries(request.body.entries()) as SalesBody : body;
      const format = (query.format ?? "xml").toLowerCase();
      const isXml = format === "xml";
      const send = (status: number, data: Record<string, unknown>) => {
        reply.code(status);
        if (isXml) return reply.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n${xmlBuilder.build({ response: data })}`);
        const jsonData = { ...data };
        const vehicle = data.vehicle_details;
        if (vehicle && typeof vehicle === "object") {
          jsonData.vehicle_details = Object.fromEntries(
            Object.entries(vehicle).map(([key, value]) => [key.replaceAll("_", " "), value]),
          );
        }
        return reply.type("application/json").send(jsonData);
      };
      if (format !== "json" && format !== "xml") return send(400, { success: false, error: { message: "Unsupported format" } });

      const credentials = credentialsFrom(request, body);
      if (!credentials.username || !credentials.password) return send(401, { success: false, error: { message: "Authentication required" } });
      const user = await User.findOne({ username: credentials.username, deletedAt: null })
        .lean<{ passwordHash: string; role: string }>();
      const argon2 = await import("argon2");
      if (!user || !user.passwordHash.startsWith("$argon2") || !(await argon2.verify(user.passwordHash, credentials.password))) {
        return send(401, { success: false, error: { message: "Invalid credentials" } });
      }

      if (user.role === "viewer") {
        return send(403, { success: false, error: { message: "Insufficient permissions" } });
      }

      const parsedVin = vinSchema.safeParse(params.vin);
      if (!parsedVin.success) return send(400, { success: false, error: { message: "A valid 17-character VIN is required" } });
      const expirationDays = await getInvoiceExpirationDays();
      const cutoff = invoiceExpirationCutoff(new Date(), expirationDays);
      const invoice: any = await Invoice.findOne({ vin: parsedVin.data, reportDate: { $gt: cutoff } })
        .select("_id vin buyerCompany buyerRfc buyerAddress buyerCity saleDate totalSales dataAnalyst year make model")
        .lean();
      if (!invoice) return send(404, { success: false, error: { message: "Vehicle details not found", vin: parsedVin.data } });

      return send(200, {
        success: true,
        user_status: user.role,
        query_timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
        vehicle_details: {
          Invoice_Number: invoice._id,
          Full_Vin: invoice.vin,
          Year: invoice.year,
          Make: invoice.make,
          Model: invoice.model,
          Company_Name: invoice.buyerCompany,
          RFC: invoice.buyerRfc,
          Address: invoice.buyerAddress,
          City: invoice.buyerCity,
          Sale_Date: invoice.saleDate,
          Total_Sales_Price: invoice.totalSales,
          Data_Analyst: invoice.dataAnalyst,
        },
      });
    };

  for (const url of ["/api/v1/sales", "/data.php"]) {
    app.route<{ Querystring: SalesQuery; Body: SalesBody }>({
      method: ["GET", "POST"],
      url,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      handler,
    });
  }
}
