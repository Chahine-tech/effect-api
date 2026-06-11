import { SqlClient } from "@effect/sql"
import { Effect, Layer, Schema } from "effect"
import { Unauthorized } from "@myapp/contract"
import { SessionRepository } from "../../domain/session.js"
import { SqlClientLive } from "./db.js"
import { decodeMany, sqlError } from "./sql-helpers.js"

const SessionRow = Schema.Struct({
  id: Schema.String,
  user_id: Schema.Number,
})

type SessionRow = typeof SessionRow.Type

export const SessionRepositoryLive = Layer.effect(
  SessionRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    return {
      create: (userId, meta) =>
        Effect.gen(function* () {
          const token = yield* Effect.sync(() => {
            const bytes = crypto.getRandomValues(new Uint8Array(32))
            return Array.from(bytes)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("")
          })
          yield* sql`
            INSERT INTO sessions (id, user_id, expires_at, ip, user_agent)
            VALUES (
              ${token},
              ${userId},
              ${new Date(Date.now() + 86400 * 1000)},
              ${meta.ip ?? null},
              ${meta.userAgent ?? null}
            )
          `.pipe(Effect.mapError(sqlError))
          return token
        }),

      verify: (token) =>
        sql`
          SELECT id, user_id FROM sessions
          WHERE id = ${token} AND expires_at > NOW()
        `.pipe(
          Effect.flatMap(decodeMany(SessionRow)),
          Effect.flatMap((r) => {
            const session = r[0]
            if (!session)
              return Effect.fail(new Unauthorized({ message: "Session expired or not found" }))
            return Effect.succeed({ userId: session.user_id })
          }),
          Effect.mapError((_) => new Unauthorized({ message: "Invalid session" }))
        ),

      revoke: (token) =>
        sql`DELETE FROM sessions WHERE id = ${token}`.pipe(
          Effect.mapError(sqlError),
          Effect.asVoid
        ),

      revokeAll: (userId) =>
        sql`DELETE FROM sessions WHERE user_id = ${userId}`.pipe(
          Effect.mapError(sqlError),
          Effect.asVoid
        ),
    }
  })
).pipe(Layer.provide(SqlClientLive))
