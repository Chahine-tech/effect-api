import { Effect, Layer, Ref } from "effect"
import { Conflict, NotFound, User } from "@myapp/contract"
import { UserRepository } from "../../domain/user.js"

interface UserRow {
  id: number
  name: string
  email: string
  passwordHash: string
}

const toUser = (row: UserRow): User => new User({ id: row.id, name: row.name, email: row.email })

export const makeInMemoryUserRepo = (initial: UserRow[] = []) =>
  Layer.effect(
    UserRepository,
    Effect.gen(function* () {
      const store = yield* Ref.make<UserRow[]>(initial)
      const nextId = yield* Ref.make(initial.length + 1)

      return {
        findById: (id) =>
          Ref.get(store).pipe(
            Effect.flatMap((rows) => {
              const row = rows.find((r) => r.id === id)
              return row ? Effect.succeed(toUser(row)) : Effect.fail(new NotFound({ message: `User ${id} not found` }))
            })
          ),

        findByEmail: (email) =>
          Ref.get(store).pipe(
            Effect.flatMap((rows) => {
              const row = rows.find((r) => r.email === email)
              return row ? Effect.succeed(toUser(row)) : Effect.fail(new NotFound({ message: "User not found" }))
            })
          ),

        findByEmailWithHash: (email) =>
          Ref.get(store).pipe(
            Effect.flatMap((rows) => {
              const row = rows.find((r) => r.email === email)
              return row
                ? Effect.succeed({ user: toUser(row), passwordHash: row.passwordHash })
                : Effect.fail(new NotFound({ message: "User not found" }))
            })
          ),

        create: (input) =>
          Effect.gen(function* () {
            const rows = yield* Ref.get(store)
            if (rows.some((r) => r.email === input.email))
              return yield* Effect.fail(new Conflict({ message: "Email already taken" }))
            const id = yield* Ref.getAndUpdate(nextId, (n) => n + 1)
            const row: UserRow = { id, ...input }
            yield* Ref.update(store, (rs) => [...rs, row])
            return toUser(row)
          }),

        remove: (id) =>
          Effect.gen(function* () {
            const rows = yield* Ref.get(store)
            if (!rows.find((r) => r.id === id))
              return yield* Effect.fail(new NotFound({ message: `User ${id} not found` }))
            yield* Ref.update(store, (rs) => rs.filter((r) => r.id !== id))
          }),

        list: () => Ref.get(store).pipe(Effect.map((rows) => rows.map(toUser))),
      }
    })
  )
