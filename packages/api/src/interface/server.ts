import { DevTools } from "@effect/experimental"
import { HttpApiBuilder, HttpApiSwagger, HttpMiddleware, HttpServer } from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Effect, Layer, Logger } from "effect"
import { createServer } from "node:http"
import { MyApi } from "@myapp/contract"

import { LoginUseCaseLive } from "../application/auth/login.js"
import { LogoutUseCaseLive } from "../application/auth/logout.js"
import { CreateUserUseCaseLive } from "../application/users/create-user.js"
import { GetUserUseCaseLive } from "../application/users/get-user.js"
import { ListUsersUseCaseLive } from "../application/users/list-users.js"
import { RemoveUserUseCaseLive } from "../application/users/remove-user.js"

import { AppConfig, AppConfigLive } from "../infrastructure/config.js"
import { SqlClientLive } from "../infrastructure/db/db.js"
import { SessionRepositoryLive } from "../infrastructure/db/session.repo.js"
import { UserRepositoryLive } from "../infrastructure/db/user.repo.js"
import { EventWorkerLive, UserEventBusLive } from "../infrastructure/events.js"
import { PasswordServiceLive } from "../infrastructure/password.js"
import { OtlpLive } from "../infrastructure/telemetry.js"

import { AuthHandlerLive } from "./handlers/auth.handler.js"
import { HealthHandlerLive } from "./handlers/health.handler.js"
import { MetricsHandlerLive } from "./handlers/metrics.handler.js"
import { UsersHandlerLive } from "./handlers/users.handler.js"
import { AuthenticationLive } from "./middleware/auth.middleware.js"
import { RateLimiterLive } from "./middleware/rate-limit.middleware.js"

const RepositoriesLive = Layer.mergeAll(UserRepositoryLive, SessionRepositoryLive).pipe(
  Layer.provide(SqlClientLive)
)

const InfraLive = Layer.mergeAll(RepositoriesLive, PasswordServiceLive)

const UseCasesLive = Layer.mergeAll(
  LoginUseCaseLive,
  LogoutUseCaseLive,
  CreateUserUseCaseLive,
  GetUserUseCaseLive,
  ListUsersUseCaseLive,
  RemoveUserUseCaseLive
)

const ApiLive = HttpApiBuilder.api(MyApi).pipe(
  Layer.provide([HealthHandlerLive, UsersHandlerLive, AuthHandlerLive, MetricsHandlerLive]),
  Layer.provide(AuthenticationLive),
  Layer.provide(UseCasesLive),
  Layer.provide(InfraLive),
  Layer.provide(RateLimiterLive)
)

const ServerLive = Effect.gen(function* () {
  const { port } = yield* AppConfig
  return NodeHttpServer.layer(createServer, { port })
}).pipe(Layer.unwrapEffect, Layer.provide(AppConfigLive))

const LoggerLive = process.env.NODE_ENV === "production" ? Logger.json : Logger.pretty

HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer()),
  Layer.provide(HttpApiBuilder.middlewareOpenApi()),
  Layer.provide(HttpApiBuilder.middlewareCors()),
  Layer.provide(ApiLive),
  Layer.provide(EventWorkerLive),
  Layer.provide(UserEventBusLive),
  HttpServer.withLogAddress,
  Layer.provide(ServerLive),
  Layer.provide(OtlpLive),
  Layer.provide(DevTools.layer()),
  Layer.provide(LoggerLive),
  Layer.launch,
  NodeRuntime.runMain
)
