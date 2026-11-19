import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import argon2 from "argon2";
import mongoose from "mongoose";
import { User, Invoice } from "../db/schema.js";
import {
  requireAuth,
  requireRole,
  endAllSessionsForUser,
} from "./auth.js";
import {
  teamUserSchema,
  createTeamUserSchema,
  updateTeamUserSchema,
  resetPasswordSchema,
  type TeamUser,
  type CreateTeamUserInput,
  type UpdateTeamUserInput,
} from "@dataaxcess/shared";

type UserPage = {
  items: TeamUser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type UserQuery = {
  q?: string;
  page?: string;
  pageSize?: string;
  role?: string;
}

function toTeamUser(row: { _id: { toHexString: () => string } | string; username: string; fullName: string; role: string; createdAt: Date | string }): TeamUser {
  return {
    id: typeof row._id === "string" ? row._id : row._id.toHexString(),
    username: row.username,
    fullName: row.fullName,
    role: row.role as TeamUser["role"],
    createdAt: typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString(),
  };
}

export async function registerUsersRoutes(app: FastifyInstance) {
  app.get<{ Querystring: UserQuery }>("/api/users", {
    preHandler: requireRole("admin"),
  }, async (request, reply) => {
    const query = request.query.q?.trim().slice(0, 100) ?? "";
    const page = Number(request.query.page ?? 1);
    const pageSize = Number(request.query.pageSize ?? 20);
    if (!Number.isInteger(page) || page < 1 || page > 1_000_000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return reply.code(400).send({ error: "Invalid pagination parameters" });
    }

    const conditions: Record<string, unknown> = { deletedAt: null };
    if (query) {
      const regex = { $regex: query, $options: "i" };
      conditions.$or = [{ username: regex }, { fullName: regex }];
    }
    if (request.query.role) {
      conditions.role = request.query.role as "admin" | "agent";
    }

    const total = await User.countDocuments(conditions);
    const rows = await User.find(conditions)
      .select("username fullName role createdAt")
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .skip((page - 1) * pageSize)
      .lean({ virtuals: true });

    const result: UserPage = {
      items: rows.map(toTeamUser),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
    return result;
  });

  app.get("/api/users/count", {
    preHandler: requireAuth,
  }, async (request, reply) => {
    const total = await User.countDocuments({ deletedAt: null });
    return reply.code(200).send({ count: total });
  });

  app.get<{ Params: { id: string } }>("/api/users/:id", {
    preHandler: requireRole("admin"),
  }, async (request, reply) => {
    const id = request.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.code(400).send({ error: "Invalid user id" });
    }

    const row = await User.findOne({ _id: new mongoose.Types.ObjectId(id), deletedAt: null })
      .select("username fullName role createdAt")
      .lean({ virtuals: true });

    if (!row) return reply.code(404).send({ error: "User not found" });
    return toTeamUser(row);
  });

  app.post<{ Body: unknown }>("/api/users", {
    preHandler: requireRole("admin"),
  }, async (request, reply) => {
    const parsed = createTeamUserSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Check the required fields and try again." });

    const input = parsed.data as CreateTeamUserInput;
    try {
      const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
      await User.create({
        username: input.username,
        fullName: input.fullName,
        passwordHash,
        role: input.role,
      });
      const row = await User.findOne({ username: input.username })
        .select("username fullName role createdAt")
        .lean({ virtuals: true });
      if (!row) return reply.code(500).send({ error: "Failed to create user" });
      return reply.code(201).send(toTeamUser(row));
    } catch (error) {
      const dbError = error as { code?: number; errno?: number };
      if (dbError.code === 11000) {
        return reply.code(409).send({ error: "A user with this username already exists." });
      }
      throw error;
    }
  });

  app.patch<{ Params: { id: string }; Body: unknown }>("/api/users/:id", {
    preHandler: requireRole("admin"),
  }, async (request, reply) => {
    const id = request.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.code(400).send({ error: "Invalid user id" });
    }

    const parsed = updateTeamUserSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Check the required fields and try again." });

    const input = parsed.data as UpdateTeamUserInput;

    const existing = await User.findOne({ _id: new mongoose.Types.ObjectId(id), deletedAt: null }).lean();
    if (!existing) return reply.code(404).send({ error: "User not found" });

    try {
      await User.updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        { ...input, updatedAt: new Date() },
      );
      await endAllSessionsForUser(id);
      const row = await User.findOne({ _id: new mongoose.Types.ObjectId(id) })
        .select("username fullName role createdAt")
        .lean({ virtuals: true });
      if (!row) return reply.code(404).send({ error: "User not found" });
      return toTeamUser(row);
    } catch (error) {
      const dbError = error as { code?: number; errno?: number };
      if (dbError.code === 11000) {
        return reply.code(409).send({ error: "A user with this username already exists." });
      }
      throw error;
    }
  });

  app.patch<{ Params: { id: string }; Body: unknown }>("/api/users/:id/password", {
    preHandler: requireRole("admin"),
  }, async (request, reply) => {
    const id = request.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.code(400).send({ error: "Invalid user id" });
    }

    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Password must be at least 12 characters." });

    const existing = await User.findOne({ _id: new mongoose.Types.ObjectId(id), deletedAt: null }).lean();
    if (!existing) return reply.code(404).send({ error: "User not found" });

    try {
      const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id });
      await User.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { passwordHash, updatedAt: new Date() });
      await endAllSessionsForUser(id);
      return reply.code(204).send();
    } catch (error) {
      throw error;
    }
  });

  app.delete<{ Params: { id: string } }>("/api/users/:id", {
    preHandler: requireRole("admin"),
  }, async (request, reply) => {
    const id = request.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return reply.code(400).send({ error: "Invalid user id" });
    }

    if (request.authUser && request.authUser.id === id) {
      return reply.code(400).send({ error: "You cannot remove your own account." });
    }

    const existing = await User.findOne({ _id: new mongoose.Types.ObjectId(id), deletedAt: null }).lean();
    if (!existing) return reply.code(404).send({ error: "User not found" });

    await User.updateOne({ _id: new mongoose.Types.ObjectId(id) }, { deletedAt: new Date(), updatedAt: new Date() });
    await Invoice.updateMany({ createdByUserId: new mongoose.Types.ObjectId(id) }, { createdByUserId: null });
    return reply.code(204).send();
  });
}
