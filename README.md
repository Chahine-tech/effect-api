# Effect API Boilerplate

Production-ready REST API with Effect, clean architecture, and end-to-end type safety.

## Stack

- **Effect** — runtime, error handling, DI, tracing, metrics, PubSub
- **@effect/platform** — HTTP server, typed API (HttpApi)
- **@effect/sql-pg** — PostgreSQL queries + migrations (no ORM)
- **argon2** — password hashing
- **oxlint** — fast linter
- **pnpm workspaces** — monorepo (`contract` / `api`)

## Structure

```
packages/
  contract/   # shared types, API schema, errors (framework-agnostic)
  api/        # backend — clean architecture
    src/
      domain/         # ports (Context.Tag interfaces)
      application/    # use cases
      infrastructure/ # adapters (DB, password, events, metrics)
      interface/      # HTTP handlers, middleware
      migrate.ts      # standalone migration runner
```

## Quick start

```bash
# Prerequisites: Docker, Node.js 22+, pnpm

docker compose up -d        # start PostgreSQL
pnpm install
pnpm db:migrate             # run migrations
pnpm dev                    # start server on :3000
```

Swagger UI → http://localhost:3000/docs

## Commands

```bash
pnpm dev            # dev server with watch
pnpm test           # unit + HTTP integration tests (in-memory, no DB)
pnpm typecheck      # tsc --noEmit across all packages
pnpm lint           # oxlint
pnpm db:migrate     # apply migrations
```

## Environment

```bash
DATABASE_URL=postgresql://api:api@localhost:5433/api
PORT=3000                    # optional, default 3000
NODE_ENV=production          # switches logger to JSON
```

## Features

- Cookie-based auth (httpOnly session, server-side revocation)
- Rate limiting per IP with `TestClock`-compatible implementation
- `Effect.Cache` on `GetUserUseCase` (LRU, 5 min TTL)
- Request batching (`RequestResolver.makeBatched`) for bulk user lookups
- Metrics counters (`/metrics`) — registrations, logins, auth failures
- PubSub event bus — `UserCreated` / `UserRemoved` with daemon worker
- Request tracing with `Effect.withSpan`
- Schema-validated SQL rows — `Schema.decodeUnknown` on every query result
- Pretty logs in dev, JSON logs in prod
- Effect DevTools compatible
- 16 tests — unit (use cases) + HTTP integration (in-memory, no DB)
