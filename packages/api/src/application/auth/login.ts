import { Context, Effect, Layer } from "effect"
import type { InternalError} from "@myapp/contract";
import { Unauthorized } from "@myapp/contract"
import { PasswordService } from "../../domain/password.js"
import { SessionRepository, type SessionMeta } from "../../domain/session.js"
import { UserRepository } from "../../domain/user.js"

export interface LoginInput {
  email: string
  password: string
  meta: SessionMeta
}

export class LoginUseCase extends Context.Tag("LoginUseCase")<
  LoginUseCase,
  (input: LoginInput) => Effect.Effect<string, Unauthorized | InternalError>
>() {}

export const LoginUseCaseLive = Layer.effect(
  LoginUseCase,
  Effect.gen(function* () {
    const userRepo = yield* UserRepository
    const sessionRepo = yield* SessionRepository
    const passwordService = yield* PasswordService

    return (input) =>
      Effect.gen(function* () {
        const { user, passwordHash } = yield* userRepo.findByEmailWithHash(input.email).pipe(
          Effect.mapError(() => new Unauthorized({ message: "Invalid credentials" }))
        )
        const valid = yield* passwordService.verify(input.password, passwordHash)
        if (!valid) return yield* Effect.fail(new Unauthorized({ message: "Invalid credentials" }))
        return yield* sessionRepo.create(user.id, input.meta)
      }).pipe(Effect.withSpan("LoginUseCase", { attributes: { email: input.email } }))
  })
)
