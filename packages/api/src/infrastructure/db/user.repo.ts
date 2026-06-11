import { SqlClient } from "@effect/sql"
import { Effect, Layer, Schema } from "effect"
import { InternalError, NotFound, User } from "@myapp/contract"
import { UserRepository, type CreateUserInput } from "../../domain/user.js"
import { SqlClientLive } from "./db.js"
import { decodeMany, sqlConflictOrError, sqlError } from "./sql-helpers.js"

const UserRowPublic = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  email: Schema.String,
})

const UserRowWithHash = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  email: Schema.String,
  password_hash: Schema.String,
})

type UserRowPublic = typeof UserRowPublic.Type
type UserRowWithHash = typeof UserRowWithHash.Type

const toUser = (row: UserRowPublic): User => new User({ id: row.id, name: row.name, email: row.email })

export const UserRepositoryLive = Layer.effect(
  UserRepository,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    return {
      findById: (id) =>
        sql`SELECT id, name, email FROM users WHERE id = ${id}`.pipe(
          Effect.mapError(sqlError),
          Effect.flatMap(decodeMany(UserRowPublic)),
          Effect.flatMap((r) => {
            const found = r[0]
            if (!found) return Effect.fail(new NotFound({ message: `User ${id} not found` }))
            return Effect.succeed(toUser(found))
          })
        ),

      findByEmail: (email) =>
        sql`SELECT id, name, email FROM users WHERE email = ${email}`.pipe(
          Effect.mapError(sqlError),
          Effect.flatMap(decodeMany(UserRowPublic)),
          Effect.flatMap((r) => {
            const found = r[0]
            if (!found) return Effect.fail(new NotFound({ message: `User not found` }))
            return Effect.succeed(toUser(found))
          })
        ),

      findByEmailWithHash: (email) =>
        sql`SELECT id, name, email, password_hash FROM users WHERE email = ${email}`.pipe(
          Effect.mapError(sqlError),
          Effect.flatMap(decodeMany(UserRowWithHash)),
          Effect.flatMap((r) => {
            const found = r[0]
            if (!found) return Effect.fail(new NotFound({ message: `User not found` }))
            return Effect.succeed({ user: toUser(found), passwordHash: found.password_hash })
          })
        ),

      create: (input: CreateUserInput) =>
        sql`
          INSERT INTO users (name, email, password_hash)
          VALUES (${input.name}, ${input.email}, ${input.passwordHash})
          RETURNING id, name, email
        `.pipe(
          Effect.mapError(sqlConflictOrError("Email already taken")),
          Effect.flatMap(decodeMany(UserRowPublic)),
          Effect.flatMap((r) => {
            const found = r[0]
            if (!found) return Effect.fail(new InternalError({ message: "Insert returned no row" }))
            return Effect.succeed(toUser(found))
          })
        ),

      remove: (id) =>
        sql`DELETE FROM users WHERE id = ${id} RETURNING id`.pipe(
          Effect.mapError(sqlError),
          Effect.flatMap(decodeMany(Schema.Struct({ id: Schema.Number }))),
          Effect.flatMap((r) => {
            if (!r[0]) return Effect.fail(new NotFound({ message: `User ${id} not found` }))
            return Effect.void
          })
        ),

      list: () =>
        sql`SELECT id, name, email FROM users`.pipe(
          Effect.mapError(sqlError),
          Effect.flatMap(decodeMany(UserRowPublic)),
          Effect.map((r) => r.map(toUser))
        ),

      findManyByIds: (ids) => {
        if (ids.length === 0) return Effect.succeed([])
        return sql`SELECT id, name, email FROM users WHERE id = ANY(${ids})`.pipe(
          Effect.mapError(sqlError),
          Effect.flatMap(decodeMany(UserRowPublic)),
          Effect.map((r) => r.map(toUser))
        )
      },
    }
  })
).pipe(Layer.provide(SqlClientLive))
