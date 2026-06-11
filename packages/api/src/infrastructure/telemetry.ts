import * as Otlp from "@effect/opentelemetry/Otlp"
import { NodeHttpClient } from "@effect/platform-node"
import { Config, Effect, Layer, Schema } from "effect"

export const OtlpLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const baseUrl = yield* Config.withDefault(
      Schema.Config("OTLP_ENDPOINT", Schema.NonEmptyString),
      "http://localhost:4318"
    )
    return Otlp.layerProtobuf({
      baseUrl,
      resource: { serviceName: "myapp-api" },
      metricsExportInterval: "30 seconds",
      tracerExportInterval: "5 seconds",
    }).pipe(Layer.provide(NodeHttpClient.layer))
  })
)
