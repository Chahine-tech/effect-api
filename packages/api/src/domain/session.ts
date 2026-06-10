import type { Effect } from "effect";
import { Context } from "effect"
import type { InternalError, Unauthorized } from "@myapp/contract"

export interface SessionMeta {
  ip: string
  userAgent: string
}

export class SessionRepository extends Context.Tag("SessionRepository")<
  SessionRepository,
  {
    create: (userId: number, meta: SessionMeta) => Effect.Effect<string, InternalError>
    verify: (token: string) => Effect.Effect<{ userId: number }, Unauthorized>
    revoke: (token: string) => Effect.Effect<void, InternalError>
    revokeAll: (userId: number) => Effect.Effect<void, InternalError>
  }
>() {}
