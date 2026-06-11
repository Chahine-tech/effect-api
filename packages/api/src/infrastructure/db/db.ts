import { PgClient } from "@effect/sql-pg"
import { Config, Redacted, Schema } from "effect"

export const SqlClientLive = PgClient.layerConfig({
  url: Config.map(
    Schema.Config("DATABASE_URL", Schema.NonEmptyString),
    Redacted.make
  ),
})
