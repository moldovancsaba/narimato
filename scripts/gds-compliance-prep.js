#!/usr/bin/env node
/** Remove regenerable operator bundles before gds-compliance (they contain minified hex colors). */
const fs = require('fs');
const paths = [
  'scripts/local-operator/bundle.js',
  'scripts/local-operator/bundle.css',
];
for (const p of paths) {
  try {
    fs.unlinkSync(p);
  } catch {
    /* absent */
  }
}
