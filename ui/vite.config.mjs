/**
 * NARIMATO — GDS React island build configuration (issue UI-01).
 *
 * This is a DEV-TIME build only. The generated assets under `public/ui/` are
 * committed and served by the zero-dependency Node server; `node server.js`
 * never needs this config, Vite, React or `node_modules`.
 *
 * Contract:
 *   - one entry (`src/main.jsx`) → `public/ui/island.js` + `public/ui/island.css`
 *   - the GDS stylesheet (`@sovereignsquad/gds-theme/styles.css`) is imported once
 *     by the entry, so the page links exactly one compiled GDS stylesheet
 *   - `process.env.NODE_ENV` is defined for library mode, otherwise React ships
 *     its development build and blows the JavaScript budget
 *   - `__GDS_ISLAND_VERSION__` is replaced at build time: the source build gets a
 *     sentinel, `scripts/build-ui.mjs` computes the content hash and substitutes
 *     it, so the manifest version never has to be known in advance
 *   - no hashed filenames, no timestamps: two consecutive builds of the same
 *     working tree are byte-identical
 *
 * `scripts/build-ui.mjs` post-processes the emitted files (deterministic
 * minification and unused-Mantine-CSS pruning) before writing the manifest.
 */
import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

const here = (relative) => fileURLToPath(new URL(relative, import.meta.url));

/** Placeholder replaced by the content-hash version after the bundle is written. */
export const VERSION_SENTINEL = '__GDS_ISLAND_VERSION__';

export default defineConfig({
  root: here('./'),
  base: '/ui/',
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    __GDS_ISLAND_VERSION__: JSON.stringify(VERSION_SENTINEL),
  },
  esbuild: { jsx: 'automatic' },
  build: {
    outDir: here('../public/ui'),
    emptyOutDir: true,
    target: 'es2020',
    // Minification runs once over the final concatenated bundle in build-ui.mjs;
    // a Rollup-phase esbuild pass leaves ~30% of avoidable bytes behind.
    minify: false,
    cssCodeSplit: false,
    reportCompressedSize: false,
    lib: {
      entry: here('./src/main.jsx'),
      formats: ['es'],
      fileName: () => 'island.js',
    },
    rollupOptions: {
      onwarn(warning, warn) {
        // Mantine/GDS ESM modules carry "use client" directives; Rollup's
        // MODULE_LEVEL_DIRECTIVE warning is noise for this client-only bundle.
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
      output: {
        entryFileNames: 'island.js',
        assetFileNames: 'island.[ext]',
        chunkFileNames: 'island-[name].js',
      },
    },
  },
});
