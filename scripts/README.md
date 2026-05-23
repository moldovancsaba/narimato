# Database scripts

Requires `.env.local` with `MONGODB_URI` (Atlas `mongodb+srv://`).

| Script | Purpose |
|--------|---------|
| `init-master-db.js` | Master DB + organizations collection |
| `setup-databases.js` | Seed default org in master |
| `init-default-org.js` | Default org + sample cards (org DB) |
| `backfill-org-database-name.js` | Set `databaseName` on legacy org rows |
| `seed-superadmin.js` | Admin user on master DB |

**Architecture (v7.2+):** Master DB holds `organizations` and `playsessionindices`. Each org has isolated data in `databaseName` (usually org uuid). Runtime routing: `lib/db.js` + `lib/tenantContext.js`.

Optional: `ORGANIZATION_DB_URIS` JSON map for per-org URI overrides.
