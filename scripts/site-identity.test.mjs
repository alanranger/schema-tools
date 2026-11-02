/**
 * Batch 8 task 1: every request to alanranger.com sends the honest identity. On 2 Nov a dry run's product step
 * (clean-products-csv.py, browser-style user agent) was followed 90 s later by a pre-flight 429.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_UA } from './lib/site-identity.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKIP = /(^|[\\/])_archive[\\/]|-old\.py$|-v2\.py$|node_modules/;

function scripts(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (SKIP.test(p)) return [];
    if (e.isDirectory()) return scripts(p);
    return /\.(py|mjs|js)$/.test(e.name) && !e.name.endsWith('.test.mjs') ? [p] : [];
  });
}

test('no live script sends a browser-style User-Agent to the site', () => {
  const offenders = scripts(HERE).filter((f) => /User-Agent['"]?\s*[:,]\s*['"][^'"]*(AppleWebKit|Chrome\/|Safari\/)/i.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(offenders.map((f) => path.relative(HERE, f)), []);
});

test('Python and Node use the same site identity', () => {
  const py = fs.readFileSync(path.join(HERE, 'site_identity.py'), 'utf8').match(/SITE_UA\s*=\s*"([^"]+)"/)?.[1];
  assert.equal(py, SITE_UA);
});
