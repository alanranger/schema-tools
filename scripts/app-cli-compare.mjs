#!/usr/bin/env node
/**
 * Byte-compare an app-cli output folder with the files the Schema Tools app last deployed (alanranger-schema).
 *   node scripts/app-cli-compare.mjs <out dir>   → prints identical / differing / new, with the first differing key per file
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'alanranger-schema');
const out = path.join(path.resolve(process.argv[2]), 'alanranger-schema');
// --ignore-run-dates: drop values the generators derive from "today" (offer validity, generatedAt), so a CLI run
// can be compared with an app run made on a different day.
const RUN_DATE_KEYS = new Set(['validFrom', 'priceValidUntil', 'generatedAt']);
const IGNORE_DATES = process.argv.includes('--ignore-run-dates');
const strip = (v) => (Array.isArray(v) ? v.map(strip) : v && typeof v === 'object'
  ? Object.fromEntries(Object.entries(v).filter(([k]) => !RUN_DATE_KEYS.has(k)).map(([k, x]) => [k, strip(x)])) : v);

function firstDiff(a, b, where = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return `${where || '(root)'}: ${JSON.stringify(a)?.slice(0, 60)} → ${JSON.stringify(b)?.slice(0, 60)}`;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = firstDiff(a[k], b[k], `${where}.${k}`);
    if (d) return d;
  }
  return `${where}: key order`;
}

const files = [];
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : files.push(path.join(dir, e.name))));
walk(out);
const result = { identical: 0, differing: [], new_files: [] };
for (const f of files) {
  const rel = path.relative(out, f);
  const live = path.join(REPO, rel);
  if (!fs.existsSync(live)) { result.new_files.push(rel); continue; }
  const a = fs.readFileSync(live, 'utf8'); const b = fs.readFileSync(f, 'utf8');
  if (a === b) { result.identical += 1; continue; }
  let why = 'text differs';
  try {
    const [x, y] = [JSON.parse(a), JSON.parse(b)].map((j) => (IGNORE_DATES ? strip(j) : j));
    why = firstDiff(x, y);
  } catch { /* not JSON */ }
  if (why === null) { result.identical_except_run_dates = (result.identical_except_run_dates || 0) + 1; continue; }
  result.differing.push(`${rel} — ${why}`);
}
console.log(JSON.stringify({ compared: files.length, ...result }, null, 2));
