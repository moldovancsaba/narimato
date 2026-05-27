#!/usr/bin/env node
/** CI guard: Narimato app code must use @doneisbetter/gds-* contracts, not raw Mantine semantics. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['components', 'pages', 'lib/ui'];
const SKIP_PREFIXES = ['packages/'];

/** Immersive play runtime — documented exception in docs/GDS_ADOPTION.md */
const EXEMPT_REL = new Set([
  'components/play/PlaySwipeSurface.js',
  'components/play/PlayVoteSurface.js',
]);

const RULES = [
  {
    name: 'no-legacy-gds-scope',
    pattern: /@gds\//,
    message: 'Use @doneisbetter/gds-* packages only (see gds-adoption.json)',
  },
  {
    name: 'no-direct-tabler-icons',
    pattern: /@tabler\/icons-react/,
    message: 'Import icons from @doneisbetter/gds-core (GdsIcons) instead of @tabler/icons-react',
  },
  {
    name: 'no-adhoc-confirm-modal',
    pattern: /modals\.openConfirmModal/,
    message: 'Use ConfirmDialog from @doneisbetter/gds-core for destructive confirmations',
  },
  {
    name: 'no-colored-mantine-badge',
    pattern: /<Badge[^>]*\bcolor=/,
    message: 'Use StatusBadge from @doneisbetter/gds-core for semantic status colors',
  },
  {
    name: 'no-mantine-alert',
    pattern: /<Alert\b/,
    message: 'Use StateBlock from @doneisbetter/gds-core instead of Mantine Alert',
  },
  {
    name: 'no-raw-mantine-button',
    pattern: /<Button\b/,
    message: 'Use SemanticButton or ChoiceChip from @doneisbetter/gds-core — no raw Mantine Button',
  },
  {
    name: 'no-button-color-prop',
    pattern: /<Button[^>]*\bcolor=/,
    message: 'Use SemanticButton from @doneisbetter/gds-core without Mantine color=',
  },
  {
    name: 'no-themeicon-color',
    pattern: /<ThemeIcon[^>]*\bcolor=/,
    message: 'Use GdsIcons without ThemeIcon color=, or GDS composition primitives',
  },
  {
    name: 'no-raw-mantine-accent-bg',
    pattern: /bg=["'](?:violet|green|red|orange|yellow|blue|cyan|grape|teal)\./,
    message: 'Use AccentPanel or gdsAccentPanelStyle — never raw Mantine palette bg on shells',
  },
  {
    name: 'no-legacy-narimato-shell',
    pattern: /from ['"].*NarimatoShell['"]|from ['"]\.\/NarimatoShell['"]/,
    message: 'Use PublicShell or NarimatoOperatorShell — NarimatoShell is deprecated',
  },
  {
    name: 'no-confirm-dialog-legacy-labels',
    pattern: /ConfirmDialog[\s\S]{0,400}\b(confirmLabel|cancelLabel)=/,
    message: 'Use confirmAction/cancelAction (SemanticAction) on ConfirmDialog from @doneisbetter/gds-core',
  },
];

let violations = [];

function shouldScan(rel) {
  if (EXEMPT_REL.has(rel)) return false;
  if (SKIP_PREFIXES.some((prefix) => rel.startsWith(prefix))) return false;
  return /\.(js|jsx|ts|tsx)$/.test(rel);
}

function walk(dir, cb) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, cb);
    else cb(full);
  }
}

for (const dirName of SCAN_DIRS) {
  const base = path.join(ROOT, dirName);
  walk(base, (file) => {
    const rel = path.relative(ROOT, file);
    if (!shouldScan(rel)) return;
    const content = fs.readFileSync(file, 'utf8');
    for (const rule of RULES) {
      if (rule.pattern.test(content)) {
        violations.push(`${rel}: ${rule.message} (${rule.name})`);
      }
    }
  });
}

if (violations.length) {
  console.error('GDS CI guard failed:\n' + violations.join('\n'));
  process.exit(1);
}
console.log('GDS CI guard passed');
