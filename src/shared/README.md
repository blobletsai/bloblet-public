# src/shared

Shared utilities used by both server and client bundles. Modules here must remain platform-agnostic (no direct access to Node APIs or browser globals).

Current contents:
- `appearance.ts` — sprite tier helpers and default URL resolution.
- `care.ts` — care action constants and state helpers used by both UI and API routes.
- `points.ts` — reward point formatting/normalization helpers.
- `pvp.ts` — risk/score helpers used by the challenge UI and backend checks.

As more shared code moves out of `lib/`, place it here and update imports to `@/src/shared/...` so we can eventually delete the transitional re-exports in `lib/`.
