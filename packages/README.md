# Vendored GDS packages (external dependency)

These directories are **copies of built output** from the separate [general-design-system](https://github.com/moldovancsaba/general-design-system) project. They are committed inside Narimato so deploys (e.g. Vercel) do not depend on another repo at build time.

Narimato **consumes** GDS; it is not part of the GDS monorepo.

## Update workflow

1. Change or release GDS in **its own repository**.
2. Run `npm run build` in that GDS checkout.
3. In **this** Narimato repo: `npm run gds:sync` (or copy `gds-theme/dist` and `gds-core/dist` manually).
4. Commit the updated `packages/gds-*/dist` and verify `npm run build && npm run gds:ci-guard`.

See `docs/GDS_ADOPTION.md` for adapter paths and exceptions.
