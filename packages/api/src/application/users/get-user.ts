import { Context, Effect, Layer } from "effect"
import type { InternalError, NotFound, User } from "@myapp/contract"
import { UserRepository } from "../../domain/user.js"

export class GetUserUseCase extends Context.Tag("GetUserUseCase")<
  GetUserUseCase,
  (id: number) => Effect.Effect<User, NotFound | InternalError>
>() {}

export const GetUserUseCaseLive = Layer.effect(
  GetUserUseCase,
  Effect.gen(function* () {
    const userRepo = yield* UserRepository
    return (id) => userRepo.findById(id).pipe(Effect.withSpan("GetUserUseCase", { attributes: { id } }))
  })
)
