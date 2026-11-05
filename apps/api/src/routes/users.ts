import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import argon2 from "argon2";
import { eq, or, like, count, desc } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import {
  requireAuth,
  requireRole,
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

function toTeamUser(row: { id: number; username: string; fullName: string; role: string; createdAt: Date | string }): TeamUser {
  return {
    id: row.id,
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

    const conditions = [];
    if (query) {
      conditions.push(or(
        like(users.username, `%${query}%`),
        like(users.fullName, `%${query}%`),
      ));
    }
    if (request.query.role) {
      conditions.push(eq(users.role, request.query.role as "admin" | "agent"));
    }

    const where = conditions.length > 0 ? or(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(users).where(where);
    const rows = await db.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      createdAt: users.createdAt,
    }).from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const result: UserPage = {
      items: rows.map(toTeamUser),
      page,
      pageSize,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / pageSize),
    };
    return result;
  });

  app.get<{ Params: { id: string } }>("/api/users/:id", {
    preHandler: requireRole("admin"),
  }, async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: "Invalid user id" });
    }

    const [row] = await db.select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, id)).limit(1);

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
      await db.insert(users).values({
        username: input.username,
        fullName: input.fullName,
        passwordHash,
        role: input.role,
      });
      const [row] = await db.select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.username, input.username)).limit(1);
      return reply.code(201).send(toTeamUser(row));
    } catch (error) {
      const dbError = error as { code?: string; errno?: number };
      if (dbError.code === "ER_DUP_ENTRY" || dbError.errno === 1062) {
        return reply.code(409).send({ error: "A user with this username already exists." });
      }
      throw error;
    }
  });

  app.patch<{ Params: { id: string }; Body: unknown }>("/api/users/:id", {
    preHandler: requireRole("admin"),
  }, async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: "Invalid user id" });
    }

    const parsed = updateTeamUserSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Check the required fields and try again." });

    const input = parsed.data as UpdateTeamUserInput;

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    if (!existing) return reply.code(404).send({ error: "User not found" });

    try {
      await db.update(users).set(input).where(eq(users.id, id));
      const [row] = await db.select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.id, id)).limit(1);
      return toTeamUser(row);
    } catch (error) {
      const dbError = error as { code?: string; errno?: number };
      if (dbError.code === "ER_DUP_ENTRY" || dbError.errno === 1062) {
        return reply.code(409).send({ error: "A user with this username already exists." });
      }
      throw error;
    }
  });

  app.patch<{ Params: { id: string }; Body: unknown }>("/api/users/:id/password", {
    preHandler: requireRole("admin"),
  }, async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: "Invalid user id" });
    }

    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Password must be at least 12 characters." });

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    if (!existing) return reply.code(404).send({ error: "User not found" });

    try {
      const passwordHash = await argon2.hash(parsed.data.password, { type: argon2.argon2id });
      await db.update(users).set({ passwordHash }).where(eq(users.id, id));
      return reply.code(204).send();
    } catch (error) {
      throw error;
    }
  });

  app.delete<{ Params: { id: string } }>("/api/users/:id", {
    preHandler: requireRole("admin"),
  }, async (request, reply) => {
    const id = Number(request.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return reply.code(400).send({ error: "Invalid user id" });
    }

    if (request.authUser && request.authUser.id === id) {
      return reply.code(400).send({ error: "You cannot remove your own account." });
    }

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1);
    if (!existing) return reply.code(404).send({ error: "User not found" });

    await db.delete(users).where(eq(users.id, id));
    return reply.code(204).send();
  });
}
