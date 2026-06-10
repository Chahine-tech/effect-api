import { Context, Effect, Layer } from "effect"
import type { InternalError, User } from "@myapp/contract"
import { UserRepository } from "../../domain/user.js"

export class ListUsersUseCase extends Context.Tag("ListUsersUseCase")<
  ListUsersUseCase,
  () => Effect.Effect<ReadonlyArray<User>, InternalError>
>() {}

export const ListUsersUseCaseLive = Layer.effect(
  ListUsersUseCase,
  Effect.gen(function* () {
    const userRepo = yield* UserRepository
    return () => userRepo.list().pipe(Effect.withSpan("ListUsersUseCase"))
  })
)
