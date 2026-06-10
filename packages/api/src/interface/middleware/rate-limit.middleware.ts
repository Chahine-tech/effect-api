import { HttpServerRequest } from "@effect/platform"
import { Context, Effect, Layer, Ref } from "effect"
import { TooManyRequests } from "@myapp/contract"

interface IpEntry {
  count: number
  resetAt: number
}

export class RateLimiter extends Context.Tag("RateLimiter")<
  RateLimiter,
  { check: (limit: number, windowMs: number) => Effect.Effect<void, TooManyRequests, HttpServerRequest.HttpServerRequest> }
>() {}

export const RateLimiterLive = Layer.effect(
  RateLimiter,
  Effect.gen(function* () {
    const store = yield* Ref.make(new Map<string, IpEntry>())

    return {
      check: (limit, windowMs) =>
        Effect.gen(function* () {
          const req = yield* HttpServerRequest.HttpServerRequest
          const ip =
            req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ??
            req.headers["x-real-ip"]?.toString() ??
            "unknown"
          const now = Date.now()

          yield* Ref.update(store, (map) => {
            const next = new Map(map)
            const entry = next.get(ip)
            if (!entry || now > entry.resetAt) {
              next.set(ip, { count: 1, resetAt: now + windowMs })
            } else {
              next.set(ip, { ...entry, count: entry.count + 1 })
            }
            return next
          })

          const entry = (yield* Ref.get(store)).get(ip)!
          if (entry.count > limit) {
            yield* Effect.fail(new TooManyRequests({ message: "Too many requests, slow down" }))
          }
        }),
    }
  })
)
