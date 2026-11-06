import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { sessions, users } from "../db/schema.js";

const cookieName = process.env.NODE_ENV === "production"
  ? "__Host-dataaxcess_session"
  : "dataaxcess_session";

export function registerSessionPlugin(app: FastifyInstance) {
  app.decorateRequest("authUser", null);
  app.decorateRequest("sessionId", null);
  app.addHook("preHandler", async (request) => {
    const token = request.cookies[cookieName];
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return;

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const [session] = await db.select({
      sessionId: sessions.id,
      id: users.id,
      username: users.username,
      role: users.role,
    }).from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.id, tokenHash), gt(sessions.expiresAt, new Date()), sql`${sessions.endedAt} IS NULL`))
      .limit(1);

    if (session) {
      request.authUser = { id: session.id, username: session.username, role: session.role };
      await db.update(sessions).set({ lastActivityAt: new Date() }).where(and(
        eq(sessions.id, tokenHash),
        sql`${sessions.lastActivityAt} < DATE_SUB(NOW(), INTERVAL 1 MINUTE)`,
      ));
      request.sessionId = session.sessionId;
    }
  });
}
