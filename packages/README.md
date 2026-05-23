# Vendored GDS packages

Built artifacts from `/Users/Shared/Projects/GENERAL_DESIGN_SYSTEM` (SSOT v2.2.0).

Vercel and CI cannot use machine-local `file:` paths outside this repo. After changing GDS theme or core, rebuild in the SSOT repo (`npm run build` in each package) and recopy `dist/` here:

```bash
cp -R /Users/Shared/Projects/GENERAL_DESIGN_SYSTEM/packages/gds-theme/dist packages/gds-theme/
cp -R /Users/Shared/Projects/GENERAL_DESIGN_SYSTEM/packages/gds-core/dist packages/gds-core/
```
