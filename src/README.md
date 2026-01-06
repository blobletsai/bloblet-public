# src/

Incremental restructuring home for active Bloblets code.

- `server/` — shared utilities used by API routes, database access, and background jobs.
- `client/` — browser-only helpers and component glue.

During the staged migration, legacy modules under `lib/` and `components/` may re-export from `src/`. As each area is migrated, remove the shims and import directly from `src/…`.
