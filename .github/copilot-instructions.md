# Copilot Instructions — Bible Image Generator

This file contains focused, actionable guidance for AI coding agents working in this repository. It emphasizes the project's architecture, developer workflows, conventions, and concrete file examples to be immediately productive.

**Big Picture**
- **Serverless edge-first**: The API runs as Cloudflare Workers (see `src/index.ts` and `wrangler.toml`). Frontend is a Vite React app in `frontend/` deployed to Cloudflare Pages.
- **AI model layer**: Image generation is performed by Workers AI via services in `src/services` (e.g. `ImageGenerationService.ts`).
- **Storage & state**: Generated images are stored in R2, metadata in D1 (SQLite via Wrangler D1), caching in Workers KV, and coordination in Durable Objects (see `src/durableObjects/RateLimiter.ts`).

**Where to look first (quick tour)**
- `src/services/` — business logic implemented as classes named `*Service.ts` (e.g. `ImageGenerationService.ts`). Tests live alongside in `src/services/*.test.ts` and `*.property.test.ts` for property tests.
- `src/durableObjects/` — Durable Object implementations (RateLimiter). Durable Objects implement `fetch(request)` handlers and use `state.storage`.
- `functions/` — Pages Functions (edge routing) with `functions/api/[[path]].ts` for dynamic routes.
- `frontend/` — React UI, Vite config in `vite.config.ts`, env in `frontend/.env.local`.
- `migrations/` and `scripts/` — D1 SQL migrations, local seed scripts and helpers (see `scripts/setup-local-dev.sh`).

**Developer workflows (essential commands & examples)**
- Local setup (recommended):
  - `./scripts/setup-local-dev.sh` — installs deps, creates `.dev.vars` from `.dev.vars.example`, applies local D1 migrations, and creates seed SQL.
- Run local development:
  - Worker API: `npm run dev` (runs `wrangler dev` on port 8787)
  - Frontend: `npm run dev:frontend` (Vite; port shown in script output, default 5173)
- Tests:
  - Run tests: `npm test` (Vitest)
  - Watch: `npm run test:watch`
  - UI: `npm run test:ui`
- Database migrations and local D1:
  - Apply local migrations: `npm run migrations:apply` (uses `wrangler d1 migrations apply --local`)
  - Seed local DB: `npm run db:seed` (runs SQL in `scripts/seed-local-data.sql`)
- Deploy:
  - Worker: `npm run deploy` (wrangler)
  - Frontend to Pages: `npm run deploy:pages`
  - Full deploy: `npm run deploy:all` or helper script `./scripts/deploy.sh <env>`

**Project-specific conventions & patterns**
- Services: Implemented as classes exported from `src/services/*.ts`. Constructor injection of platform abstractions (e.g., `new ImageGenerationService(ai)`) is common.
- Error handling: Many services define custom error classes (e.g., `ImageGenerationError`) and use typed `ErrorCode` enums in `src/types`.
- Durable Objects: One Durable Object per coordination concern (e.g., `RateLimiter`). They expose HTTP-like endpoints via `fetch()` with POST/GET verbs.
- Tests: Distinguish unit tests (`*.test.ts`), property tests (`*.property.test.ts`), and integration tests (`*.integration.test.ts`). When adding tests, mimic existing naming and folder placement under `src/`.
- Prompt engineering: `ImageGenerationService.constructPrompt()` shows how prompts are composed — prefer reusing `STYLE_PRESETS` and `VERSE_THEMES` rather than ad-hoc strings.

**Integration points & environment**
- External/Cloud services used:
  - Cloudflare Workers (runtime)
  - Workers AI model (configured in services)
  - R2 (object storage) — save image blobs and expose stored keys in DB
  - D1 (SQLite) — metadata and migrations under `migrations/`
  - Workers KV — caching layer used in some services
  - Turnstile CAPTCHA — optional; env flags `TURNSTILE_ENABLED`, site/secret keys used in `RateLimiter`
- Local secrets: `.dev.vars` (create from `.dev.vars.example`). The setup script copies the example automatically.

**Code-change guidance (where to make common edits)**
- Add or modify business logic: `src/services/*` (follow class + method pattern).
- Add REST endpoints / wire services into the Worker: update `src/index.ts` and `functions/api/[[path]].ts` for Pages Functions.
- Change database schema: add SQL file in `migrations/` following existing naming (e.g., `0003_...sql`) and run `npm run migrations:apply`.
- Update frontend UI: `frontend/src/` and environment in `frontend/.env.local`.

**Examples (copyable patterns)**
- Start local dev (Worker + frontend):
  - `./scripts/setup-local-dev.sh`
  - `npm run dev` (Worker) and in another terminal `npm run dev:frontend` (Frontend)
- Apply migrations & seed: `npm run migrations:apply && npm run db:seed`

**Hints for AI agents (specific DOs and DON'Ts)**
- DO reference the service classes in `src/services` and follow their constructor-injection patterns.
- DO run `wrangler d1` commands for any schema change verification (use `--local` in dev).
- DO reuse `STYLE_PRESETS` and theme extraction functions in `ImageGenerationService` when adjusting prompts.
- DON'T change environment-driven configuration inline; prefer reading from `env` and documenting required `.dev.vars` keys.
- DON'T assume synchronous model responses — services often race model calls against timeouts and wrap errors with typed classes.

If any section is unclear or you want more examples (e.g., common refactors, example PR message templates, or unit test skeletons), tell me which area to expand and I'll iterate.
