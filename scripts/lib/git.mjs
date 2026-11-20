/**
 * Small git helper for gate reports: the report records the commit it audited.
 * Returns an empty string outside a checkout instead of failing the gate.
 */
import { execFileSync } from 'node:child_process';

export function readCommit(root) {
  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}
