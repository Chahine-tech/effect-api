import { Config, Context, Effect, Layer, Schema } from "effect"

export class AppConfig extends Context.Tag("AppConfig")<
  AppConfig,
  { readonly port: number }
>() {}

export const AppConfigLive = Layer.effect(
  AppConfig,
  Effect.gen(function* () {
    const port = yield* Config.withDefault(
      Schema.Config("PORT", Schema.NumberFromString),
      3000
    )
    return { port }
  })
)
