#!/usr/bin/env node
/**
 * CI guard: dual-runtime boundary — no Ollama/worker imports on Vercel hot paths.
 * Run: npm run intelligence:ci-guard (also .github/workflows/intelligence-ci-guard.yml)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const FORBIDDEN = [
  {
    dir: 'pages/api',
    pattern: /ollama|queueAiInference|from ['"].*\/scripts\/sync|handleJob\s*\(/i,
    allow: [
      'pages/api/intelligence/sources.js',
      'pages/api/intelligence/jobs/enqueue.js',
      'pages/api/intelligence/status.js',
    ],
  },
  {
    dir: 'pages',
    pattern: /OLLAMA_HOST|scripts\/guardian|queueAiInference|ollamaGenerate/i,
    exclude: ['local-ai.js', 'local-operator.js'],
  },
  {
    dir: 'lib/services',
    pattern: /ollama|queueAiInference|jobHandlers|scripts\/lib\/core/i,
  },
  {
    dir: 'lib/services/play',
    pattern: /IntelligenceSnapshot\.find|buildWebappProjection/i,
  },
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

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

for (const rule of FORBIDDEN) {
  const base = path.join(ROOT, rule.dir);
  if (!fs.existsSync(base)) continue;
  walk(base, (file) => {
    const r = rel(file);
    if (rule.exclude?.some((e) => r.endsWith(e))) return;
    if (rule.allow?.some((a) => r === a || r.endsWith(a))) return;
    const content = fs.readFileSync(file, 'utf8');
    if (rule.pattern.test(content)) {
      violations.push(`${r} matches ${rule.pattern}`);
    }
  });
}

if (violations.length) {
  console.error(
    'Intelligence CI guard failed (see docs/INTELLIGENCE_CI_GUARDS.md):\n' +
      violations.join('\n')
  );
  process.exit(1);
}
console.log('Intelligence CI guard passed');
