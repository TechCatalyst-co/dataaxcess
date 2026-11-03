import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { pool } from "./db/index.js";
import { registerSessionPlugin } from "./plugins/session.js";
import { registerAuthRoutes, requireRole } from "./routes/auth.js";
import { registerInvoiceRoutes } from "./routes/invoices.js";

const app = Fastify({ logger: true, trustProxy: false });

await app.register(helmet);
await app.register(cors, {
  origin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  credentials: true,
});
await app.register(cookie, { hook: "onRequest" });
await app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
await app.register(rateLimit, { global: false });

registerSessionPlugin(app);
await app.register(registerAuthRoutes);
await app.register(registerInvoiceRoutes);

app.get("/health", async () => ({ ok: true }));
app.get("/api/admin/check", { preHandler: requireRole("admin") }, async (request) => ({ ok: true, user: request.authUser }));
app.addHook("onClose", async () => { await pool.end(); });

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: "0.0.0.0" });
