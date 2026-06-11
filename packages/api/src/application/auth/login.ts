import { Context, Effect, Layer, Metric } from "effect"
import type { InternalError } from "@myapp/contract"
import { Unauthorized } from "@myapp/contract"
import { PasswordService } from "../../domain/password.js"
import { SessionRepository, type SessionMeta } from "../../domain/session.js"
import { UserRepository } from "../../domain/user.js"
import { authFailuresTotal, loginsTotal } from "../../infrastructure/metrics.js"

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

    const login = Effect.fn("LoginUseCase")(function* (input: LoginInput) {
      yield* Effect.annotateCurrentSpan("email", input.email)
      const { user, passwordHash } = yield* userRepo.findByEmailWithHash(input.email).pipe(
        Effect.mapError(() => new Unauthorized({ message: "Invalid credentials" }))
      )
      const valid = yield* passwordService.verify(input.password, passwordHash)
      if (!valid) return yield* Effect.fail(new Unauthorized({ message: "Invalid credentials" }))
      return yield* sessionRepo.create(user.id, input.meta)
    })

    return (input) =>
      login(input).pipe(
        Effect.tap(() => Metric.increment(loginsTotal)),
        Effect.tapError(() => Metric.increment(authFailuresTotal))
      )
  })
)
