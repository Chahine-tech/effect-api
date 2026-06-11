import { Cookies, HttpApiBuilder, HttpServerRequest } from "@effect/platform"
import { Effect } from "effect"
import { MyApi, SESSION_COOKIE_SCHEME } from "@myapp/contract"
import { LoginUseCase } from "../../application/auth/login.js"
import { LogoutUseCase } from "../../application/auth/logout.js"
import { CreateUserUseCase } from "../../application/users/create-user.js"
import { RateLimiter } from "../middleware/rate-limit.middleware.js"

const AUTH_RATE_LIMIT = { limit: 10, windowMs: 60_000 }

export const AuthHandlerLive = HttpApiBuilder.group(MyApi, "auth", (handlers) =>
  handlers
    .handle("register", ({ payload }) =>
      Effect.gen(function* () {
        const rateLimiter = yield* RateLimiter
        yield* rateLimiter.check(AUTH_RATE_LIMIT.limit, AUTH_RATE_LIMIT.windowMs)
        const createUser = yield* CreateUserUseCase
        return yield* createUser({ name: payload.name, email: payload.email, password: payload.password })
      })
    )
    .handle("login", ({ payload }) =>
      Effect.gen(function* () {
        const rateLimiter = yield* RateLimiter
        yield* rateLimiter.check(AUTH_RATE_LIMIT.limit, AUTH_RATE_LIMIT.windowMs)
        const req = yield* HttpServerRequest.HttpServerRequest
        const login = yield* LoginUseCase
        const token = yield* login({
          email: payload.email,
          password: payload.password,
          meta: {
            ip: req.headers["x-forwarded-for"]?.toString() ?? "unknown",
            userAgent: req.headers["user-agent"]?.toString() ?? "unknown",
          },
        })
        yield* HttpApiBuilder.securitySetCookie(SESSION_COOKIE_SCHEME, token, { path: "/" })
      })
    )
    .handle("logout", (_) =>
      Effect.gen(function* () {
        const req = yield* HttpServerRequest.HttpServerRequest
        const token = Cookies.parseHeader(req.headers["cookie"] ?? "")["session"]
        if (token) {
          const logout = yield* LogoutUseCase
          yield* logout(token)
        }
        yield* HttpApiBuilder.securitySetCookie(SESSION_COOKIE_SCHEME, "", { maxAge: 0, path: "/" })
      })
    )
)
