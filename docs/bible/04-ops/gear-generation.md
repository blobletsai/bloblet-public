# Gear Icon Generation Runbook (Nano Banana)

This runbook regenerates gear icons for the 1–8 OP/DP tiers and wires them into the app.

## Model & Providers
- Generation: Nano Banana (kie.ai) — TTI by default; I2I edit if a source URL is provided.
- Cleanup: Bria background removal (fal.ai) — safety pass only.
- Output: 256×256 PNG, transparent background, nearest-neighbor downscale for crisp pixels.

## Env
- Required: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `KIE_API_KEY`, `FAL_KEY`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_PERSIST` (or `SPRITES_BUCKET`)
- Optional: `R2_PUBLIC_BASE_URL`, `R2_REGION`, `R2_CACHE_CONTROL`, `GEAR_SOURCE_WEAPON_URL`, `GEAR_SOURCE_SHIELD_URL`

## Run
```bash
# From repo root
npm run gear:gen
```
- Concurrency: 5 (two full batches + one partial + final single → 16 total).
- Prompts: landmark-aligned (“8‑bit pixel art icon…”) with a strong NEGATIVE block to avoid non‑pixel artifacts.
- R2 paths: `gear/weapon_t{1..8}.png`, `gear/shield_t{1..8}.png`.
- DB wiring: `pvp_items.icon_url` updated automatically.

## Verify
- Supabase:
  - `select type, count(*), count(icon_url) from public.pvp_items group by type;` → 8/8 per slot with icons
- UI:
  - Loadout → Equipped row shows icons with tier pills; owner‑only details enforced.

## Notes
- No gameplay impact — art only. OP/DP stats remain 1–8.
- Re‑run safely any time; URLs will be overwritten.

