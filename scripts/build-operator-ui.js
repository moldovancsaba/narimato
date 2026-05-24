#!/usr/bin/env node
/** Bundle the local operator console for status-server (:10006). */
const esbuild = require('esbuild');
const path = require('path');

const entry = path.join(__dirname, 'local-operator/entry.jsx');
const outfile = path.join(__dirname, 'local-operator/bundle.js');

esbuild
  .build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    loader: { '.js': 'jsx', '.css': 'css' },
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'info',
  })
  .then(() => {
    console.log(`Operator UI bundled → ${outfile}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
