#!/usr/bin/env node
/** CI guard: forbid Ollama / intelligence imports on Vercel read paths. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FORBIDDEN = [
  { dir: 'pages/api', pattern: /ollama|queueAiInference|scripts\/sync/i },
  { dir: 'pages', pattern: /OLLAMA_HOST|scripts\/guardian/i, exclude: ['local-ai.js'] },
];

let violations = [];

function walk(dir, cb) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, cb);
    else if (/\.(js|jsx|ts|tsx)$/.test(name)) cb(full);
  }
}

for (const rule of FORBIDDEN) {
  const base = path.join(ROOT, rule.dir);
  if (!fs.existsSync(base)) continue;
  walk(base, (file) => {
    const rel = path.relative(ROOT, file);
    if (rule.exclude?.some((e) => rel.endsWith(e))) return;
    const content = fs.readFileSync(file, 'utf8');
    if (rule.pattern.test(content)) {
      violations.push(`${rel} matches ${rule.pattern}`);
    }
  });
}

if (violations.length) {
  console.error('Intelligence CI guard failed:\n' + violations.join('\n'));
  process.exit(1);
}
console.log('Intelligence CI guard passed');
