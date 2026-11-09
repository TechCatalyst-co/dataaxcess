import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { XMLBuilder } from "fast-xml-parser";
import { eq } from "drizzle-orm";
import { vinSchema } from "@dataaxcess/shared";
import { db } from "../db/index.js";
import { invoices, users } from "../db/schema.js";

type SalesQuery = { vin?: string; format?: string; user?: string; password?: string };
type SalesBody = { vin?: string; format?: string; user?: string; pass?: string; password?: string };

const basicAuthHeader = (request: FastifyRequest) => request.headers.authorization
  ?? request.headers["http-authorization"] as string | undefined
  ?? request.headers["redirect-http-authorization"] as string | undefined;

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
  // Match the documented form fields without accepting secrets in query strings.
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
      // The live service selects format from the query string; POST body format is ignored.
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
      if (format !== "json" && format !== "xml") return send(400, { success: false, error: { message: "Unsupported format", format } });

      const credentials = credentialsFrom(request, body);
      if (!credentials.username || !credentials.password) return send(401, { success: false, error: { message: "Authentication required" } });
      const [user] = await db.select({ id: users.id, passwordHash: users.passwordHash, role: users.role })
        .from(users).where(eq(users.username, credentials.username)).limit(1);
      // API credentials use a username and password. Accept secure Argon2 hashes only;
      // do not reintroduce the legacy deployment's plaintext password comparison.
      const argon2 = await import("argon2");
      if (!user || !user.passwordHash.startsWith("$argon2") || !(await argon2.verify(user.passwordHash, credentials.password))) {
        return send(401, { success: false, error: { message: "Invalid credentials" } });
      }

      const parsedVin = vinSchema.safeParse(params.vin);
      if (!parsedVin.success) return send(400, { success: false, error: { message: "A valid 17-character VIN is required" } });
      const [invoice] = await db.select({
        invoiceNumber: invoices.invoiceNumber,
        vin: invoices.vin,
        buyerCompany: invoices.buyerCompany,
        buyerRfc: invoices.buyerRfc,
        buyerAddress: invoices.buyerAddress,
        buyerCity: invoices.buyerCity,
        saleDate: invoices.saleDate,
        totalSales: invoices.totalSales,
        dataAnalyst: invoices.dataAnalyst,
        year: invoices.year,
        make: invoices.make,
        model: invoices.model,
      }).from(invoices).where(eq(invoices.vin, parsedVin.data)).limit(1);
      if (!invoice) return send(404, { success: false, error: { message: "Vehicle details not found", vin: parsedVin.data } });

      return send(200, {
        success: true,
        user_status: user.role,
        query_timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
        vehicle_details: {
          Invoice_Number: invoice.invoiceNumber,
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
