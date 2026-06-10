import { Context, Effect, Layer } from "effect"
import type { Conflict, InternalError, User } from "@myapp/contract";
import { BadRequest } from "@myapp/contract"
import { PasswordService } from "../../domain/password.js"
import { UserRepository } from "../../domain/user.js"

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

    return (input) =>
      Effect.gen(function* () {
        if (input.password.length < 8)
          return yield* Effect.fail(new BadRequest({ message: "Password must be at least 8 characters" }))
        const passwordHash = yield* passwordService.hash(input.password)
        return yield* userRepo.create({ name: input.name, email: input.email, passwordHash })
      }).pipe(Effect.withSpan("CreateUserUseCase", { attributes: { email: input.email } }))
  })
)
