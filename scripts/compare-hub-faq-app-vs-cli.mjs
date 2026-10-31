#!/usr/bin/env node
/**
 * Proof that the hub FAQ files have one producer: the packaged desktop app's Event Posts tab (generate only, no
 * deploy) and the CLI used by Update all write byte-identical beginners-photography-lessons_faq.json and
 * photographic-workshops-near-me_faq.json from the same inputs.
 *   node scripts/compare-hub-faq-app-vs-cli.mjs --out <dir> [--csv <csv dir>] [--mappings <05 mappings csv>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { packagedMatchesSource, savedSettingsMatch, withDesktopApp } from './lib/desktop-app.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.resolve(ROOT, '..');
const arg = (flag, fallback) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : fallback; };
const OUT = path.resolve(arg('--out', path.join(ROOT, 'outputs', 'hub-faq-proof')));
const CSV = path.resolve(arg('--csv', path.join(WEB, 'alan-shared-resources', 'csv')));
const MAPPINGS = path.resolve(arg('--mappings', path.join(WEB, 'alan-shared-resources', 'csv processed', '05-event-product-mappings-latest.csv')));
const HUB_FILES = ['beginners-photography-lessons_faq.json', 'photographic-workshops-near-me_faq.json'];

const appHubFiles = () => withDesktopApp(async (win) => {
  await win.waitForFunction(() => typeof window.generateEventPostBundle === 'function', null, { timeout: 60000 });
  const saved = await savedSettingsMatch(win, ROOT);
  if (!saved.same) throw new Error(`desktop app saved options differ from scripts/app-settings.json: ${JSON.stringify(saved.actual)}`);
  await win.setInputFiles('#eventPostsLessonsCsvFile', path.join(CSV, '02-beginners-photography-lessons.csv'));
  await win.setInputFiles('#eventPostsWorkshopsCsvFile', path.join(CSV, '03-photographic-workshops-near-me.csv'));
  await win.setInputFiles('#eventPostsMappingsCsvFile', MAPPINGS);
  if (!(await win.evaluate(() => generateEventPostBundle()))) throw new Error('desktop app: Event Posts generate failed');
  return win.evaluate((names) => (window.currentEventPerPageFiles || []).filter((f) => names.includes(f.fileName)), HUB_FILES);
});

function cliHubFiles() {
  const out = path.join(OUT, 'cli');
  const r = spawnSync('node', ['scripts/app-cli.mjs', 'event-posts', '--out', out, '--csv', CSV, '--mappings', MAPPINGS], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`cli: ${r.stderr || r.stdout}`);
  return HUB_FILES.map((f) => path.join(out, 'alanranger-schema', f));
}

async function main() {
  const code = packagedMatchesSource(ROOT);
  console.log(JSON.stringify({ packaged_app_code: code }));
  if (!code.every((c) => c.identical)) throw new Error('packaged desktop app differs from source: rebuild it first (npm run build:desktop)');
  const fromApp = await appHubFiles();
  fs.mkdirSync(path.join(OUT, 'app'), { recursive: true });
  fromApp.forEach((f) => fs.writeFileSync(path.join(OUT, 'app', f.fileName), f.jsonContent, 'utf8'));
  const cliPaths = cliHubFiles();
  const result = HUB_FILES.map((name, i) => {
    const a = path.join(OUT, 'app', name);
    const b = cliPaths[i];
    const both = fs.existsSync(a) && fs.existsSync(b);
    return { file: name, app_bytes: both ? fs.statSync(a).size : null, cli_bytes: both ? fs.statSync(b).size : null,
      byte_identical: both && fs.readFileSync(a).equals(fs.readFileSync(b)) };
  });
  fs.writeFileSync(path.join(OUT, 'hub-faq-app-vs-cli.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.every((r) => r.byte_identical)) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
