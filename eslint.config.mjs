import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import { createGdsConfig, resolveAllowedImports } from '@doneisbetter/gds-eslint-config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const manifest = JSON.parse(
  readFileSync(path.join(__dirname, 'gds-adoption.json'), 'utf8')
);

const gdsExemptPlaySurfaces = [
  'components/play/PlaySwipeSurface.js',
  'components/play/PlayVoteSurface.js',
  'components/NarimatoSemanticButton.js',
];

const eslintConfig = [
  {
    ignores: [
      '**/node_modules/**',
      '.next/**',
      'packages/**',
      'scripts/local-operator/bundle.js',
      'scripts/local-operator/bundle.css',
    ],
  },
  ...compat.extends('next/core-web-vitals'),
  ...createGdsConfig({ allowedImports: resolveAllowedImports(manifest) }),
  {
    files: gdsExemptPlaySurfaces,
    rules: {
      'gds/no-raw-design-values': 'off',
      'gds/no-forbidden-ui-imports': 'off',
    },
  },
];

export default eslintConfig;
