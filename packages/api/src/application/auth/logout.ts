import { Context, Effect, Layer } from "effect"
import type { InternalError } from "@myapp/contract"
import { SessionRepository } from "../../domain/session.js"

export class LogoutUseCase extends Context.Tag("LogoutUseCase")<
  LogoutUseCase,
  (token: string) => Effect.Effect<void, InternalError>
>() {}

export const LogoutUseCaseLive = Layer.effect(
  LogoutUseCase,
  Effect.gen(function* () {
    const sessionRepo = yield* SessionRepository
    return (token) => sessionRepo.revoke(token).pipe(Effect.withSpan("LogoutUseCase"))
  })
)
