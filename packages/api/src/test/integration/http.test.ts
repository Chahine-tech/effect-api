import { FetchHttpClient, HttpApiBuilder, HttpApiClient, HttpServer } from "@effect/platform"
import { afterAll, beforeAll, describe, expect, vi } from "vitest"
import { it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { MyApi } from "@myapp/contract"

import { LoginUseCaseLive } from "../../application/auth/login.js"
import { LogoutUseCaseLive } from "../../application/auth/logout.js"
import { CreateUserUseCaseLive } from "../../application/users/create-user.js"
import { GetUserUseCaseLive } from "../../application/users/get-user.js"
import { ListUsersUseCaseLive } from "../../application/users/list-users.js"
import { RemoveUserUseCaseLive } from "../../application/users/remove-user.js"

import { AuthHandlerLive } from "../../interface/handlers/auth.handler.js"
import { HealthHandlerLive } from "../../interface/handlers/health.handler.js"
import { UsersHandlerLive } from "../../interface/handlers/users.handler.js"
import { AuthenticationLive } from "../../interface/middleware/auth.middleware.js"
import { RateLimiterLive } from "../../interface/middleware/rate-limit.middleware.js"

import { FakePasswordService } from "../helpers/fake-password.service.js"
import { InMemorySessionRepo } from "../helpers/in-memory-session.repo.js"
import { makeInMemoryUserRepo } from "../helpers/in-memory-user.repo.js"

const TestInfraLive = Layer.mergeAll(makeInMemoryUserRepo(), InMemorySessionRepo, FakePasswordService)

const TestUseCasesLive = Layer.mergeAll(
  LoginUseCaseLive,
  LogoutUseCaseLive,
  CreateUserUseCaseLive,
  GetUserUseCaseLive,
  ListUsersUseCaseLive,
  RemoveUserUseCaseLive
)

const TestApiLive = HttpApiBuilder.api(MyApi).pipe(
  Layer.provide([HealthHandlerLive, UsersHandlerLive, AuthHandlerLive]),
  Layer.provide(AuthenticationLive),
  Layer.provide(TestUseCasesLive),
  Layer.provide(TestInfraLive),
  Layer.provide(RateLimiterLive)
)

// Cookie jar partagé — reset explicitement par test si besoin
const jar = { cookie: "" }

let dispose: () => Promise<void>

beforeAll(() => {
  const { handler, dispose: d } = HttpApiBuilder.toWebHandler(
    Layer.mergeAll(TestApiLive, HttpServer.layerContext)
  )
  dispose = d

  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    if (jar.cookie) headers.set("Cookie", jar.cookie)
    const res = await handler(new Request(input as string, { ...init, headers }))
    const setCookie = res.headers.get("Set-Cookie")
    if (setCookie) {
      const match = setCookie.match(/session=([^;]+)/)
      if (match) jar.cookie = `session=${match[1]}`
    }
    return res
  })
})

afterAll(async () => {
  await dispose()
  vi.unstubAllGlobals()
})

const client = HttpApiClient.make(MyApi, { baseUrl: "http://localhost" }).pipe(
  Effect.provide(FetchHttpClient.layer)
)

const uniq = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2)}@test.com`

describe("HTTP Integration", () => {
  it.effect("GET /health → { status: ok }", () =>
    Effect.gen(function* () {
      const c = yield* client
      const res = yield* c.health.check()
      expect(res.status).toBe("ok")
      expect(res.uptime).toBeTypeOf("number")
    })
  )

  it.effect("POST /auth/register → 201 + User", () =>
    Effect.gen(function* () {
      const c = yield* client
      const user = yield* c.auth.register({
        payload: { name: "Alice", email: uniq("alice"), password: "password123" },
      })
      expect(user.name).toBe("Alice")
      expect(user.id).toBeTypeOf("number")
    })
  )

  it.effect("GET /users/ sans session → Unauthorized", () =>
    Effect.gen(function* () {
      jar.cookie = ""
      const c = yield* client
      const err = yield* c.users.list().pipe(Effect.flip)
      expect(err._tag).toBe("Unauthorized")
    })
  )

  it.effect("flow complet : register → login → list → logout", () =>
    Effect.gen(function* () {
      jar.cookie = ""
      const email = uniq("bob")
      const c = yield* client

      const user = yield* c.auth.register({
        payload: { name: "Bob", email, password: "password123" },
      })
      yield* c.auth.login({ payload: { email, password: "password123" } })

      expect(jar.cookie).toMatch(/session=/)

      const users = yield* c.users.list()
      expect(users.some((u) => u.id === user.id)).toBe(true)

      const found = yield* c.users.findById({ path: { id: user.id } })
      expect(found.email).toBe(email)

      yield* c.auth.logout()
    })
  )

  it.effect("login mauvais mot de passe → Unauthorized", () =>
    Effect.gen(function* () {
      jar.cookie = ""
      const email = uniq("charlie")
      const c = yield* client

      yield* c.auth.register({ payload: { name: "Charlie", email, password: "password123" } })
      const err = yield* c.auth.login({ payload: { email, password: "wrong" } }).pipe(Effect.flip)
      expect(err._tag).toBe("Unauthorized")
    })
  )

  it.effect("email dupliqué → Conflict", () =>
    Effect.gen(function* () {
      const email = uniq("dup")
      const c = yield* client

      yield* c.auth.register({ payload: { name: "A", email, password: "password123" } })
      const err = yield* c.auth.register({ payload: { name: "B", email, password: "password456" } }).pipe(
        Effect.flip
      )
      expect(err._tag).toBe("Conflict")
    })
  )
})
