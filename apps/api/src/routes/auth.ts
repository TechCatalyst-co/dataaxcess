import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import mongoose from "mongoose";
import { loginSchema } from "@dataaxcess/shared";
import { Session, User } from "../db/schema.js";
import type { AuthUser } from "../types.js";

const isProduction = process.env.NODE_ENV === "production";
const cookieName = isProduction ? "__Host-dataaxcess_session" : "dataaxcess_session";
const sessionDurationMs = 8 * 60 * 60 * 1000;

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post<{ Body: unknown }>("/api/auth/login", {
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      console.log(JSON.stringify({
        level: "warn",
        workflow: "auth_login",
        step: "validation",
        message: "Zod validation failed",
      }));
      return reply.code(400).send({ error: "Invalid username or password" });
    }

    const username = parsed.data.username;
    console.log(JSON.stringify({
      level: "info",
      workflow: "auth_login",
      step: "user_lookup",
      username,
    }));

    const user = await User.findOne({ username, deletedAt: null }).lean<{ _id: { toHexString: () => string }; passwordHash: string; failedLoginAttempts: number; lockedUntil: Date | null; username: string; role: string; deletedAt: Date | null }>();

    if (!user) {
      console.log(JSON.stringify({
        level: "warn",
        workflow: "auth_login",
        step: "user_lookup",
        message: "User not found or soft-deleted",
        username,
      }));
      return reply.code(401).send({ error: "Invalid username or password" });
    }

    console.log(JSON.stringify({
      level: "debug",
      workflow: "auth_login",
      step: "user_lookup",
      message: "User found",
      userId: user._id.toHexString(),
      username: user.username,
      role: user.role,
      lockedUntil: user.lockedUntil,
      deletedAt: user.deletedAt,
    }));

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      console.log(JSON.stringify({
        level: "warn",
        workflow: "auth_login",
        step: "lockout_check",
        message: "Account locked",
        userId: user._id.toHexString(),
        lockedUntil: user.lockedUntil,
      }));
      return reply.code(401).send({ error: "Invalid username or password" });
    }

    const passwordValid = await argon2.verify(user.passwordHash, parsed.data.password);

    if (!passwordValid) {
      const nextAttempts = Number(user.failedLoginAttempts) + 1;
      const update: Record<string, unknown> = { failedLoginAttempts: nextAttempts, updatedAt: new Date() };
      if (nextAttempts >= 5) {
        update.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await User.updateOne({ _id: user._id }, update);

      console.log(JSON.stringify({
        level: "warn",
        workflow: "auth_login",
        step: "password_verify",
        message: "Invalid password",
        userId: user._id.toHexString(),
        nextAttempts,
        locked: nextAttempts >= 5,
      }));
      return reply.code(401).send({ error: "Invalid username or password" });
    }

    await User.updateOne({ _id: user._id }, { failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() });

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + sessionDurationMs);
    await endAllSessionsForUser(user._id.toHexString());
    await Session.create({ _id: tokenHash, userId: user._id, expiresAt, lastActivityAt: new Date() });

    console.log(JSON.stringify({
      level: "info",
      workflow: "auth_login",
      step: "session_created",
      userId: user._id.toHexString(),
      username: user.username,
      role: user.role,
      tokenHash,
      expiresAt,
    }));

    reply.setCookie(cookieName, token, {
      path: "/",
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: sessionDurationMs / 1000,
    });
    return { user: { id: user._id.toHexString(), username: user.username, role: user.role }, expiresAt };
  });

  app.post("/api/auth/logout", { preHandler: requireAuth }, async (request, reply) => {
    const token = request.cookies[cookieName];
    if (token) {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await Session.updateOne({ _id: tokenHash }, { endedAt: new Date() });
    }
    return reply.clearCookie(cookieName, { path: "/", secure: isProduction, sameSite: "strict" })
      .code(204).send();
  });

  app.get("/api/auth/me", { preHandler: requireAuth }, async (request, reply) => {
    const authUserId = request.authUser!.id;
    if (!mongoose.Types.ObjectId.isValid(authUserId)) {
      return reply.code(400).send({ error: "Invalid user session." });
    }
    const user = await User.findOne({ _id: new mongoose.Types.ObjectId(authUserId) })
      .lean<{ _id: { toHexString: () => string }; username: string; fullName: string; role: string }>();
    if (!user) return reply.code(404).send({ error: "User not found" });
    return { user: { id: user._id.toHexString(), username: user.username, fullName: user.fullName, role: user.role } };
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

export async function endAllSessionsForUser(userId: string) {
  await Session.updateMany(
    { userId: new mongoose.Types.ObjectId(userId), endedAt: null },
    { endedAt: new Date() },
  );
}
