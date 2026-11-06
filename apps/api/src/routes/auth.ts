import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { loginSchema } from "@dataaxcess/shared";
import { db } from "../db/index.js";
import { sessions, users } from "../db/schema.js";
import type { AuthUser } from "../types.js";

const isProduction = process.env.NODE_ENV === "production";
const cookieName = isProduction ? "__Host-dataaxcess_session" : "dataaxcess_session";
const sessionDurationMs = 8 * 60 * 60 * 1000;

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: unknown }>("/api/auth/login", {
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid username or password" });

    const [user] = await db.select().from(users).where(eq(users.username, parsed.data.username)).limit(1);
    if (!user || !(await argon2.verify(user.passwordHash, parsed.data.password))) {
      return reply.code(401).send({ error: "Invalid username or password" });
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + sessionDurationMs);
    await db.insert(sessions).values({ id: tokenHash, userId: user.id, expiresAt, lastActivityAt: new Date() });

    reply.setCookie(cookieName, token, {
      path: "/",
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: sessionDurationMs / 1000,
    });
    return { user: { id: user.id, username: user.username, role: user.role }, expiresAt };
  });

  app.post("/api/auth/logout", { preHandler: requireAuth }, async (request, reply) => {
    const token = request.cookies[cookieName];
    if (token) {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await db.update(sessions).set({ endedAt: new Date() }).where(eq(sessions.id, tokenHash));
    }
    return reply.clearCookie(cookieName, { path: "/", secure: isProduction, sameSite: "strict" })
      .code(204).send();
  });

  app.get("/api/auth/me", { preHandler: requireAuth }, async (request) => {
    const [user] = await db.select({ id: users.id, username: users.username, fullName: users.fullName, role: users.role })
      .from(users).where(eq(users.id, request.authUser!.id)).limit(1);
    return { user };
  });
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.authUser) return reply.code(401).send({ error: "Authentication required" });
}

export function requireRole(role: AuthUser["role"]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.authUser) return reply.code(401).send({ error: "Authentication required" });
    if (request.authUser.role !== role) return reply.code(403).send({ error: "Insufficient permissions" });
  };
}
