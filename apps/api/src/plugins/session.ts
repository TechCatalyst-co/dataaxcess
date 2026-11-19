import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { Session } from "../db/schema.js";

const cookieName = process.env.NODE_ENV === "production"
  ? "__Host-dataaxcess_session"
  : "dataaxcess_session";

export function registerSessionPlugin(app: FastifyInstance) {
  app.decorateRequest("authUser", null);
  app.decorateRequest("sessionId", null);
  app.addHook("preHandler", async (request) => {
    const token = request.cookies[cookieName];
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      console.log(JSON.stringify({
        level: "debug",
        workflow: "session_restore",
        step: "cookie_check",
        message: "No valid session cookie",
        hasCookie: Boolean(token),
      }));
      return;
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    console.log(JSON.stringify({
      level: "debug",
      workflow: "session_restore",
      step: "session_lookup",
      tokenHash,
    }));

    const session: any = await Session.findOne({
      _id: tokenHash,
      expiresAt: { $gt: new Date() },
      endedAt: null,
    }).populate("userId").lean();

    if (!session) {
      console.log(JSON.stringify({
        level: "debug",
        workflow: "session_restore",
        step: "session_lookup",
        message: "Session not found, expired, or ended",
        tokenHash,
      }));
      return;
    }

    if (!session.userId) {
      console.log(JSON.stringify({
        level: "warn",
        workflow: "session_restore",
        step: "populate_check",
        message: "Session has no populated userId (dangling reference)",
        tokenHash,
        sessionId: session._id,
      }));
      return;
    }

    if (session.userId.deletedAt) {
      console.log(JSON.stringify({
        level: "warn",
        workflow: "session_restore",
        step: "deleted_at_check",
        message: "Session user is soft-deleted",
        tokenHash,
        userId: session.userId._id?.toHexString?.() ?? session.userId._id,
      }));
      return;
    }

    request.authUser = {
      id: session.userId._id.toHexString(),
      username: session.userId.username,
      role: session.userId.role,
    };

    console.log(JSON.stringify({
      level: "info",
      workflow: "session_restore",
      step: "auth_user_set",
      userId: request.authUser.id,
      username: request.authUser.username,
      role: request.authUser.role,
      sessionId: session._id,
    }));

    await Session.updateOne(
      { _id: tokenHash, lastActivityAt: { $lt: new Date(Date.now() - 60_000) } },
      { lastActivityAt: new Date() },
    );
    request.sessionId = session._id;
  });
}
