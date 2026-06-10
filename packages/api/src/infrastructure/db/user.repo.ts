import { eq } from "drizzle-orm"
import { Effect, Layer } from "effect"
import { Conflict, InternalError, NotFound, User } from "@myapp/contract"
import { UserRepository, type CreateUserInput } from "../../domain/user.js"
import { Database } from "./db.js"
import { users } from "./schema.js"

const toUser = (row: { id: number; name: string; email: string }): User =>
  new User({ id: row.id, name: row.name, email: row.email })

const catchSql = (e: unknown) => {
  const cause = (e as { cause?: { code?: string } })?.cause
  if (cause?.code === "23505") return new Conflict({ message: "Email already taken" })
  return new InternalError({ message: String(e) })
}

export const UserRepositoryLive = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const db = yield* Database

    return {
      findById: (id) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () => db.select().from(users).where(eq(users.id, id)),
            catch: (e) => new InternalError({ message: String(e) }),
          })
          const row = result[0]
          if (!row) return yield* Effect.fail(new NotFound({ message: `User ${id} not found` }))
          return toUser(row)
        }),

      findByEmail: (email) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () => db.select().from(users).where(eq(users.email, email)),
            catch: (e) => new InternalError({ message: String(e) }),
          })
          const row = result[0]
          if (!row) return yield* Effect.fail(new NotFound({ message: `User not found` }))
          return toUser(row)
        }),

      findByEmailWithHash: (email) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () => db.select().from(users).where(eq(users.email, email)),
            catch: (e) => new InternalError({ message: String(e) }),
          })
          const row = result[0]
          if (!row) return yield* Effect.fail(new NotFound({ message: `User not found` }))
          return { user: toUser(row), passwordHash: row.passwordHash }
        }),

      create: (input: CreateUserInput) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () =>
              db
                .insert(users)
                .values({ name: input.name, email: input.email, passwordHash: input.passwordHash })
                .returning(),
            catch: catchSql,
          })
          const row = result[0]
          if (!row)
            return yield* Effect.fail(new InternalError({ message: "Insert returned no row" }))
          return toUser(row)
        }),

      remove: (id) =>
        Effect.gen(function* () {
          const result = yield* Effect.tryPromise({
            try: () => db.delete(users).where(eq(users.id, id)).returning(),
            catch: (e) => new InternalError({ message: String(e) }),
          })
          if (!result[0])
            return yield* Effect.fail(new NotFound({ message: `User ${id} not found` }))
        }),

      list: () =>
        Effect.tryPromise({
          try: () => db.select().from(users),
          catch: (e) => new InternalError({ message: String(e) }),
        }).pipe(Effect.map((rows) => rows.map(toUser))),
    }
  })
)
