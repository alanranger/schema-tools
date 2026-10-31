#!/usr/bin/env node
/**
 * Proof that the hub FAQ files have one producer: the packaged desktop app's Event Posts tab (generate only, no
 * deploy) and the CLI used by Update all write byte-identical beginners-photography-lessons_faq.json and
 * photographic-workshops-near-me_faq.json from the same inputs.
 *   node scripts/compare-hub-faq-app-vs-cli.mjs --out <dir> [--csv <csv dir>] [--mappings <05 mappings csv>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.resolve(ROOT, '..');
const arg = (flag, fallback) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : fallback; };
const OUT = path.resolve(arg('--out', path.join(ROOT, 'outputs', 'hub-faq-proof')));
const CSV = path.resolve(arg('--csv', path.join(WEB, 'alan-shared-resources', 'csv')));
const MAPPINGS = path.resolve(arg('--mappings', path.join(WEB, 'alan-shared-resources', 'csv processed', '05-event-product-mappings-latest.csv')));
const APP_DIR = path.join(process.env.LOCALAPPDATA, 'SchemaTools', 'SchemaTools-win32-x64');
const PACKAGED = path.join(APP_DIR, 'resources', 'app');
const HUB_FILES = ['beginners-photography-lessons_faq.json', 'photographic-workshops-near-me_faq.json'];
const DEBUG_PORT = 9333;

/** The packaged desktop build must carry the same app code as the source the CLI loads. */
function packagedMatchesSource() {
  return ['index.html', 'main.js', 'preload.js'].map((f) => ({ file: f,
    identical: fs.readFileSync(path.join(PACKAGED, f)).equals(fs.readFileSync(path.join(ROOT, f))) }));
}

/** Starts the installed SchemaTools.exe with a DevTools port and attaches to its window over CDP. */
async function attachToDesktopApp() {
  const proc = spawn(path.join(APP_DIR, 'SchemaTools.exe'), [`--remote-debugging-port=${DEBUG_PORT}`], { stdio: 'ignore' });
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`).catch(() => null);
    const win = browser?.contexts().flatMap((c) => c.pages()).find((p) => p.url().endsWith('index.html'));
    if (win) return { proc, browser, win };
    await browser?.close().catch(() => {});
  }
  proc.kill();
  throw new Error('desktop app window not reachable on the DevTools port');
}

async function appHubFiles() {
  const { proc, browser, win } = await attachToDesktopApp();
  try {
    await win.waitForFunction(() => typeof window.generateEventPostBundle === 'function', null, { timeout: 60000 });
    win.on('dialog', (d) => d.accept().catch(() => {}));
    await win.setInputFiles('#eventPostsLessonsCsvFile', path.join(CSV, '02-beginners-photography-lessons.csv'));
    await win.setInputFiles('#eventPostsWorkshopsCsvFile', path.join(CSV, '03-photographic-workshops-near-me.csv'));
    await win.setInputFiles('#eventPostsMappingsCsvFile', MAPPINGS);
    if (!(await win.evaluate(() => generateEventPostBundle()))) throw new Error('desktop app: Event Posts generate failed');
    return await win.evaluate((names) => (window.currentEventPerPageFiles || []).filter((f) => names.includes(f.fileName)), HUB_FILES);
  } finally {
    await browser.close().catch(() => {});
    proc.kill();
  }
}

function cliHubFiles() {
  const out = path.join(OUT, 'cli');
  const r = spawnSync('node', ['scripts/app-cli.mjs', 'event-posts', '--out', out, '--csv', CSV, '--mappings', MAPPINGS], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`cli: ${r.stderr || r.stdout}`);
  return HUB_FILES.map((f) => path.join(out, 'alanranger-schema', f));
}

async function main() {
  const code = packagedMatchesSource();
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
