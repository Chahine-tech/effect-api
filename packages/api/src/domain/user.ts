import type { Effect } from "effect";
import { Context } from "effect"
import type { Conflict, InternalError, NotFound, User } from "@myapp/contract"

export interface CreateUserInput {
  name: string
  email: string
  passwordHash: string
}

export class UserRepository extends Context.Tag("UserRepository")<
  UserRepository,
  {
    findById: (id: number) => Effect.Effect<User, NotFound | InternalError>
    findByEmail: (email: string) => Effect.Effect<User, NotFound | InternalError>
    findByEmailWithHash: (
      email: string
    ) => Effect.Effect<{ user: User; passwordHash: string }, NotFound | InternalError>
    create: (input: CreateUserInput) => Effect.Effect<User, Conflict | InternalError>
    remove: (id: number) => Effect.Effect<void, NotFound | InternalError>
    list: () => Effect.Effect<ReadonlyArray<User>, InternalError>
  }
>() {}
