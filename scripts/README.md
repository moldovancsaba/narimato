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
