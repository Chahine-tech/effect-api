import { Context, Effect, Layer } from "effect"
import type { InternalError, NotFound } from "@myapp/contract"
import { UserRepository } from "../../domain/user.js"

export class RemoveUserUseCase extends Context.Tag("RemoveUserUseCase")<
  RemoveUserUseCase,
  (id: number) => Effect.Effect<void, NotFound | InternalError>
>() {}

export const RemoveUserUseCaseLive = Layer.effect(
  RemoveUserUseCase,
  Effect.gen(function* () {
    const userRepo = yield* UserRepository
    return (id) => userRepo.remove(id).pipe(Effect.withSpan("RemoveUserUseCase", { attributes: { id } }))
  })
)
