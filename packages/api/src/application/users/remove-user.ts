import { Context, Effect, Layer, PubSub } from "effect"
import type { InternalError, NotFound } from "@myapp/contract"
import { UserRepository } from "../../domain/user.js"
import { UserEventBus } from "../../infrastructure/events.js"

export class RemoveUserUseCase extends Context.Tag("RemoveUserUseCase")<
  RemoveUserUseCase,
  (id: number) => Effect.Effect<void, NotFound | InternalError>
>() {}

export const RemoveUserUseCaseLive = Layer.effect(
  RemoveUserUseCase,
  Effect.gen(function* () {
    const userRepo = yield* UserRepository
    const eventBus = yield* UserEventBus

    return Effect.fn("RemoveUserUseCase")(function* (id: number) {
      yield* Effect.annotateCurrentSpan("id", id)
      yield* userRepo.remove(id)
      yield* PubSub.publish(eventBus, { _tag: "UserRemoved", userId: id })
    })
  })
)
