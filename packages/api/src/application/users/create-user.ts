import { Context, Effect, Layer, Metric, PubSub } from "effect"
import type { Conflict, InternalError, User } from "@myapp/contract"
import { BadRequest } from "@myapp/contract"
import { PasswordService } from "../../domain/password.js"
import { UserRepository } from "../../domain/user.js"
import { UserEventBus } from "../../infrastructure/events.js"
import { registrationsTotal } from "../../infrastructure/metrics.js"

export interface CreateUserInput {
  name: string
  email: string
  password: string
}

export class CreateUserUseCase extends Context.Tag("CreateUserUseCase")<
  CreateUserUseCase,
  (input: CreateUserInput) => Effect.Effect<User, BadRequest | Conflict | InternalError>
>() {}

export const CreateUserUseCaseLive = Layer.effect(
  CreateUserUseCase,
  Effect.gen(function* () {
    const userRepo = yield* UserRepository
    const passwordService = yield* PasswordService
    const eventBus = yield* UserEventBus

    return Effect.fn("CreateUserUseCase")(function* (input: CreateUserInput) {
      yield* Effect.annotateCurrentSpan("email", input.email)
      if (input.password.length < 8)
        return yield* Effect.fail(new BadRequest({ message: "Password must be at least 8 characters" }))
      const passwordHash = yield* passwordService.hash(input.password)
      const user = yield* userRepo.create({ name: input.name, email: input.email, passwordHash })
      yield* PubSub.publish(eventBus, { _tag: "UserCreated", userId: user.id, email: input.email })
      yield* Metric.increment(registrationsTotal)
      return user
    })
  })
)
