import { Effect, Layer, Ref } from "effect"
import { Unauthorized } from "@myapp/contract"
import { SessionRepository } from "../../domain/session.js"

interface SessionRow {
  id: string
  userId: number
  expiresAt: Date
  ip: string
  userAgent: string
}

export const InMemorySessionRepo = Layer.effect(
  SessionRepository,
  Effect.gen(function* () {
    const store = yield* Ref.make<SessionRow[]>([])

    return {
      create: (userId, meta) =>
        Effect.gen(function* () {
          const token = Math.random().toString(36).slice(2)
          yield* Ref.update(store, (rows) => [
            ...rows,
            { id: token, userId, expiresAt: new Date(Date.now() + 86400_000), ...meta },
          ])
          return token
        }),

      verify: (token) =>
        Ref.get(store).pipe(
          Effect.flatMap((rows) => {
            const session = rows.find((r) => r.id === token && r.expiresAt > new Date())
            return session
              ? Effect.succeed({ userId: session.userId })
              : Effect.fail(new Unauthorized({ message: "Invalid session" }))
          })
        ),

      revoke: (token) =>
        Ref.update(store, (rows) => rows.filter((r) => r.id !== token)).pipe(Effect.asVoid),

      revokeAll: (userId) =>
        Ref.update(store, (rows) => rows.filter((r) => r.userId !== userId)).pipe(Effect.asVoid),
    }
  })
)
