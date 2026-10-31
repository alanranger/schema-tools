// npm run test:csv-builders
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FEEDS, LIVE_CSV, londonParts, parseCsv, pathKey } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const haveFeeds = fs.existsSync(path.join(FEEDS, 'blog-on-photography.json')) && fs.existsSync(path.join(FEEDS, 'commerce-api-products-v2.json'));

test('parseCsv handles quotes, escaped quotes, multi-line cells and a BOM', () => {
  const rows = parseCsv('\uFEFFa,b\r\n"x, y","he said ""hi"""\n"line1\nline2",z\n');
  assert.deepEqual(rows, [['a', 'b'], ['x, y', 'he said "hi"'], ['line1\nline2', 'z']]);
});

test('londonParts uses Europe/London (BST in summer, GMT in winter)', () => {
  assert.deepEqual(londonParts(Date.UTC(2026, 6, 1, 9, 30, 5)), { date: '2026-07-01', time: '10:30', seconds: '10:30:05' });
  assert.deepEqual(londonParts(Date.UTC(2026, 11, 1, 23, 15, 0)), { date: '2026-12-01', time: '23:15', seconds: '23:15:00' });
});

test('pathKey normalises host, case and trailing slash', () => {
  assert.equal(pathKey('https://www.alanranger.com/Blog-On-Photography/Foo/'), '/blog-on-photography/foo');
  assert.equal(pathKey('/photo-workshops-uk'), '/photo-workshops-uk');
});

function build(script, env) {
  const r = spawnSync('node', [path.join(HERE, script)], { env: { ...process.env, ...env }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

const fmt = (file) => {
  const buf = fs.readFileSync(file);
  const text = buf.toString('utf8');
  return { bom: buf[0] === 0xef, crlf: /\r\n/.test(text), trailing: /[\r\n]$/.test(text), header: text.replace(/^\uFEFF/, '').split(/\r?\n/)[0] };
};

test('build-exact reproduces every export\'s byte format (BOM, line endings, final newline, header)', { skip: !haveFeeds && 'no cached feeds' }, () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'csvb-'));
  build('build-exact.mjs', { CSV_BUILDERS_OUT: out });
  for (const f of ['01-blog-posts.csv', '02-beginners-photography-lessons.csv', '03-photographic-workshops-near-me.csv',
    '04-photography-services-courses-mentoring.csv', '05-photo-workshops-uk-landscape.csv', '08-landing-and-service-pages.csv']) {
    assert.deepEqual(fmt(path.join(out, f)), fmt(path.join(LIVE_CSV, f)), f);
  }
});

test('build-raw01-api: hidden products included, categories carried forward by default; strict mode available', { skip: !haveFeeds && 'no cached feeds' }, () => {
  const carry = fs.mkdtempSync(path.join(os.tmpdir(), 'csvb-'));
  const strict = fs.mkdtempSync(path.join(os.tmpdir(), 'csvb-'));
  assert.match(build('build-raw01-api.mjs', { CSV_BUILDERS_OUT: carry }), /carry=true/);
  assert.match(build('build-raw01-api.mjs', { CSV_BUILDERS_OUT: strict, CARRY_HIDDEN_CATEGORIES: '0' }), /carry=false/);
  const rows = (dir) => parseCsv(fs.readFileSync(path.join(dir, 'raw-01-products-sqsp-export.csv'), 'utf8'));
  const [hdr, ...body] = rows(carry);
  const vis = hdr.indexOf('Visible'); const cat = hdr.indexOf('Categories');
  const hidden = body.filter((r) => r[vis] === 'No');
  assert.ok(hidden.length >= 20, 'hidden products present');
  assert.ok(hidden.some((r) => r[cat]), 'carried-forward categories on hidden products');
  assert.ok(rows(strict).slice(1).filter((r) => r[vis] === 'No').every((r) => !r[cat]), 'strict mode leaves hidden categories blank');
  assert.deepEqual(fmt(path.join(carry, 'raw-01-products-sqsp-export.csv')), fmt(path.join(LIVE_CSV, 'raw-01-products-sqsp-export.csv')));
});
