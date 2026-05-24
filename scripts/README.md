# Database scripts

Requires `MONGODB_URI` in `.env.local` (Atlas `mongodb+srv://`).

```bash
vercel link --project narimato --yes   # once
vercel env pull .env.local --yes       # refresh secrets
```

All scripts call `scripts/load-env.js` (loads `.env.local` then `.env`).

| Script | Purpose |
|--------|---------|
| `init-master-db.js` | Master DB + organizations collection |
| `setup-databases.js` | Seed default org in master |
| `init-default-org.js` | Default org + sample cards (org DB) |
| `backfill-org-database-name.js` | Set `databaseName` on legacy org rows |
| `smoke-multi-tenant.js` | Verify master + per-org routing |
| `e2e-v1-play.js` | E2E swipe_only + vote_only (needs `npm run dev`) |
| `seed-superadmin.js` | Admin user on master DB |

**Architecture (v7.2+):** Master DB holds `organizations` and `playsessionindices`. Each org has isolated data in `databaseName` (usually org uuid). Runtime routing: `lib/db.js` + `lib/tenantContext.js`.

Optional: `ORGANIZATION_DB_URIS` JSON map for per-org URI overrides.

## Local AI intelligence (v7.2+)

See `docs/LOCAL_AI_PIPELINE.md` and `docs/NARIMATO_INTELLIGENCE_SSOT.md`.

| npm script | Purpose |
|------------|---------|
| `intelligence:guardian` | Supervisor: sync + snapshot-worker + status-server |
| `intelligence:status-server` | Operator console http://127.0.0.1:10006 |
| `intelligence:sync` | Foreground job worker (:10005) |
| `intelligence:snapshot-worker` | Projection refresh (:10007) |
| `intelligence:init` | Ensure intelligence Mongo collections/indexes |
| `intelligence:smoke-projection` | Build + read projection smoke test |
| `intelligence:backfill-approval` | Legacy cards → `approvalStatus: approved` |
| `intelligence:e2e` | E2E fixture path (needs guardian + dev server) |
| `intelligence:ci-guard` | Forbid Ollama on Vercel API routes |

macOS launchd: `npm run intelligence:install` (see `scripts/install-intelligence-launchd.sh`)
