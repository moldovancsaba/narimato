#!/usr/bin/env node
/** CI guard: enforce GDS adoption rules in app code (GDS 2.3.0). */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['components', 'pages', 'lib/ui'];
const SKIP_PREFIXES = ['packages/'];

const RULES = [
  {
    name: 'no-direct-tabler-icons',
    pattern: /@tabler\/icons-react/,
    message: 'Import icons from @gds/core (GdsIcons) instead of @tabler/icons-react',
  },
  {
    name: 'no-adhoc-confirm-modal',
    pattern: /modals\.openConfirmModal/,
    message: 'Use ConfirmDialog from @gds/core for destructive confirmations',
  },
  {
    name: 'no-colored-mantine-badge',
    pattern: /<Badge[^>]*\bcolor=/,
    message: 'Use StatusBadge from @gds/core for semantic status colors',
  },
  {
    name: 'no-legacy-narimato-shell',
    pattern: /from ['"].*NarimatoShell['"]|from ['"]\.\/NarimatoShell['"]/,
    message: 'Use PublicShell or NarimatoOperatorShell — NarimatoShell is deprecated',
  },
  {
    name: 'no-confirm-dialog-legacy-labels',
    pattern: /ConfirmDialog[\s\S]{0,400}\b(confirmLabel|cancelLabel)=/,
    message: 'Use confirmAction/cancelAction (SemanticAction) on ConfirmDialog from @gds/core',
  },
];

let violations = [];

function shouldScan(rel) {
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
