import { Cache, Context, Duration, Effect, Layer } from "effect"
import type { InternalError, NotFound, User } from "@myapp/contract"
import { UserRepository } from "../../domain/user.js"

export class GetUserUseCase extends Context.Tag("GetUserUseCase")<
  GetUserUseCase,
  (id: number) => Effect.Effect<User, NotFound | InternalError>
>() {}

export const GetUserUseCaseLive = Layer.scoped(
  GetUserUseCase,
  Effect.gen(function* () {
    const userRepo = yield* UserRepository
    const cache = yield* Cache.make({
      capacity: 1000,
      timeToLive: Duration.minutes(5),
      lookup: (id: number) => userRepo.findById(id),
    })

    return Effect.fn("GetUserUseCase")(function* (id: number) {
      yield* Effect.annotateCurrentSpan("id", id)
      return yield* cache.get(id)
    })
  })
)
