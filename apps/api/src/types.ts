import type { Role } from "@dataaxcess/shared";

export type AuthUser = { id: number; username: string; role: Role };

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser | null;
    sessionId: string | null;
  }
}
