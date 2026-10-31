#!/usr/bin/env node
/**
 * Proof for the Event Index BAU step: the installed desktop app's Event Index Schema tab (generate only, no deploy)
 * and the CLI used by Update all produce byte-identical lessons-schema.json and workshops-schema.json.
 *   node scripts/compare-event-index-app-vs-cli.mjs --out <dir> [--csv <csv dir>] [--mappings <05 csv>] [--processed <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { packagedMatchesSource, savedSettingsMatch, withDesktopApp } from './lib/desktop-app.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.resolve(ROOT, '..');
const arg = (flag, fallback) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : fallback; };
const OUT = path.resolve(arg('--out', path.join(ROOT, 'outputs', 'event-index-proof')));
const CSV = path.resolve(arg('--csv', path.join(WEB, 'alan-shared-resources', 'csv')));
const PROCESSED = path.resolve(arg('--processed', path.join(WEB, 'alan-shared-resources', 'csv processed')));
const MAPPINGS = path.resolve(arg('--mappings', path.join(PROCESSED, '05-event-product-mappings-latest.csv')));
const RUNS = [['lessons', '02-beginners-photography-lessons.csv'], ['workshops', '03-photographic-workshops-near-me.csv']];

async function appRun(win, csv) {
  await win.reload({ waitUntil: 'domcontentloaded' });
  await win.waitForFunction(() => typeof window.generateEventSchema === 'function', null, { timeout: 60000 });
  await win.setInputFiles('#eventCsvFile', path.join(CSV, csv));
  await win.waitForFunction(() => Array.isArray(events) && events.length > 0, null, { timeout: 30000 });
  await win.setInputFiles('#mappingsCsvFile', MAPPINGS);
  for (const [sel, name] of [['#productsExcelFile', '02 – products_cleaned.xlsx'], ['#reviewsCsvFile', '03 – combined_product_reviews.csv']]) {
    if (fs.existsSync(path.join(PROCESSED, name))) await win.setInputFiles(sel, path.join(PROCESSED, name));
  }
  await win.evaluate(() => generateEventSchema());
  return win.evaluate(() => JSON.stringify(cleanupSchemaForExport(window.currentEventSchema), null, 2));
}

async function main() {
  const code = packagedMatchesSource(ROOT);
  console.log(JSON.stringify({ packaged_app_code: code }));
  if (!code.every((c) => c.identical)) throw new Error('packaged desktop app differs from source: rebuild it first (npm run build:desktop)');
  fs.mkdirSync(path.join(OUT, 'app'), { recursive: true });
  await withDesktopApp(async (win) => {
    const saved = await savedSettingsMatch(win, ROOT);
    console.log(JSON.stringify({ app_saved_settings_match_cli: saved.same }));
    if (!saved.same) throw new Error(`desktop app saved options differ from scripts/app-settings.json: ${JSON.stringify(saved.actual)}`);
    for (const [type, csv] of RUNS) fs.writeFileSync(path.join(OUT, 'app', `${type}-schema.json`), await appRun(win, csv), 'utf8');
  });
  const cli = spawnSync('node', ['scripts/app-cli.mjs', 'event-index', '--out', path.join(OUT, 'cli'), '--csv', CSV, '--mappings', MAPPINGS, '--processed', PROCESSED],
    { cwd: ROOT, encoding: 'utf8' });
  if (cli.status !== 0) throw new Error(`cli: ${cli.stderr || cli.stdout}`);
  const result = RUNS.map(([type]) => {
    const a = path.join(OUT, 'app', `${type}-schema.json`);
    const b = path.join(OUT, 'cli', 'alanranger-schema', `${type}-schema.json`);
    return { file: `${type}-schema.json`, app_bytes: fs.statSync(a).size, cli_bytes: fs.statSync(b).size, byte_identical: fs.readFileSync(a).equals(fs.readFileSync(b)) };
  });
  fs.writeFileSync(path.join(OUT, 'event-index-app-vs-cli.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.every((r) => r.byte_identical)) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
