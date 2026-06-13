import { HttpApiBuilder, HttpServerResponse } from "@effect/platform"
import { Effect, PubSub, Schedule, Stream } from "effect"
import type { UserEvent } from "../../infrastructure/events.js"
import { UserEventBus } from "../../infrastructure/events.js"

const encoder = new TextEncoder()

const makeEventsEffect = (bus: PubSub.PubSub<UserEvent>) => {
  const events = Stream.unwrapScoped(
    Effect.gen(function* () {
      const queue = yield* PubSub.subscribe(bus)
      return Stream.fromQueue(queue).pipe(
        Stream.map((event) => {
          const msg = `event: ${event._tag}\ndata: ${JSON.stringify(event)}\n\n`
          return encoder.encode(msg)
        })
      )
    })
  )

  // Send a comment every 30s to keep the connection alive through proxies
  const keepalive = Stream.fromSchedule(Schedule.fixed("30 seconds")).pipe(
    Stream.as(encoder.encode(": keepalive\n\n"))
  )

  return Effect.sync(() =>
    HttpServerResponse.stream(Stream.merge(events, keepalive), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  )
}

export const EventsHandlerLive = HttpApiBuilder.Router.use((router) =>
  Effect.gen(function* () {
    const bus = yield* UserEventBus
    yield* router.get("/events", makeEventsEffect(bus))
  })
)
