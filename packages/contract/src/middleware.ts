import { HttpApiMiddleware, HttpApiSecurity } from "@effect/platform"
import { Context } from "effect"
import { Unauthorized } from "./errors.js"
import type { User } from "./schemas.js"

export class CurrentUser extends Context.Tag("CurrentUser")<CurrentUser, User>() {}

export const SESSION_COOKIE_SCHEME = HttpApiSecurity.apiKey({
  in: "cookie",
  key: "session",
})

export class Authentication extends HttpApiMiddleware.Tag<Authentication>()(
  "Authentication",
  {
    failure: Unauthorized,
    provides: CurrentUser,
    security: { session: SESSION_COOKIE_SCHEME },
  }
) {}
