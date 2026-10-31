#!/usr/bin/env node
/**
 * Command-line runs of the Schema Tools app's own generators (no rewrite): loads index.html in headless Chrome
 * with web security off (as the Electron window runs) and a stand-in window.electronAPI that writes every file
 * the app would write — including "deploys" — into --out instead of the real schema repo / shared outputs.
 *
 *   node scripts/app-cli.mjs event-posts --out <dir> --csv <csv dir> --mappings <05-event-product-mappings-latest.csv>
 *   node scripts/app-cli.mjs blog-index  --out <dir> --csv <csv dir>
 *   node scripts/app-cli.mjs landings    --out <dir> [--paths /home,/about-alan-ranger]
 *
 * Output: <out>/alanranger-schema/... and <out>/alan-shared-resources/... (mirrors of the real paths), plus
 * <out>/app-cli-report.json. Requests to alanranger.com made through the API stand-in are paced.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const WEB = path.resolve(ROOT, '..');
const REPO = path.join(ROOT, 'alanranger-schema');
const arg = (flag, fallback = '') => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : fallback; };
const COMMAND = process.argv[2];
const OUT = path.resolve(arg('--out') || path.join(ROOT, 'outputs', 'app-cli'));
const CSV = path.resolve(arg('--csv') || path.join(WEB, 'alan-shared-resources', 'csv'));
const GAP_MS = Number(process.env.ALAN_SITE_GAP_SECONDS || 1.5) * 1000;
const writes = [];
let lastSiteRequest = 0;

/** Real path → mirror inside OUT (only paths under Website Code are allowed). */
function mirror(realPath) {
  const rel = path.relative(WEB, path.resolve(realPath));
  if (rel.startsWith('..')) throw new Error(`refusing to write outside Website Code: ${realPath}`);
  return path.join(OUT, rel.replace(/^Schema Tools[\\/]/, ''));
}
const repoMirror = (fileName) => path.join(OUT, 'alanranger-schema', fileName);
const readFirst = (...files) => { const f = files.find((x) => fs.existsSync(x)); return f ? fs.readFileSync(f, 'utf8') : null; };

function writeOut(target, content) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  writes.push(path.relative(OUT, target));
}

async function pacedFetch(url, opts) {
  if (/alanranger\.com/.test(url)) {
    const wait = GAP_MS - (Date.now() - lastSiteRequest);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastSiteRequest = Date.now();
  }
  return fetch(url, opts);
}

/** The electronAPI methods the generators use; deploy-type calls only write into OUT. */
const API = {
  getAppBuildMetadata: () => ({ app: 'SchemaTools', mode: 'app-cli' }),
  readFile: (p) => { const c = readFirst(mirror(p), p); if (c == null) throw new Error(`File not found: ${p}`); return { success: true, content: c }; },
  writeFile: (p, content) => { writeOut(mirror(p), content); return { success: true }; },
  readSchemaFile: (name) => { const c = readFirst(repoMirror(name), path.join(REPO, name)); if (c == null) throw new Error(`Schema file not found: ${name}`); return c; },
  checkFileExists: (name) => fs.existsSync(repoMirror(name)) || fs.existsSync(path.join(REPO, name)),
  saveAndDeploySchema: (name, json) => { writeOut(repoMirror(name), json); return { success: true, message: 'app-cli: written to --out (no git)', filePath: repoMirror(name) }; },
  saveSchemaToOutputs: (name, json) => { writeOut(path.join(OUT, 'alan-shared-resources', 'outputs', 'schema', name), json); return { success: true }; },
  batchDeploySchemas: (files) => { files.forEach((f) => writeOut(repoMirror(f.fileName), f.jsonContent)); return { success: true, message: `app-cli: ${files.length} files written to --out`, deletedCount: 0 }; },
  httpGetManual: async (url) => { const r = await pacedFetch(url, { method: 'GET', redirect: 'manual' }); return { status: r.status, location: r.headers.get('location') || '' }; }
};

async function openApp(browser) {
  const page = await browser.newPage();
  page.on('dialog', (d) => { console.log(`[app dialog] ${d.message().slice(0, 200)}`); d.accept().catch(() => {}); });
  page.on('pageerror', (e) => console.error(`[app error] ${String(e.message || e).slice(0, 300)}`));
  await page.exposeFunction('__appCliCall', async (method, args) => {
    if (!API[method]) return { success: false, error: `${method} is not available in app-cli` };
    return API[method](...args);
  });
  await page.addInitScript((methods) => {
    const api = { isElectron: true };
    methods.forEach((m) => { api[m] = (...args) => window.__appCliCall(m, args); });
    window.electronAPI = api;
  }, Object.keys(API));
  // The app's page fetch tries public CORS proxies first (20 s timeouts each). Answer the first one with a direct,
  // paced fetch in its own response shape, so the same app code runs without third-party hops.
  await page.route('https://api.allorigins.win/get?**', async (route) => {
    const target = new URL(route.request().url()).searchParams.get('url');
    const res = await pacedFetch(target, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124 Safari/537.36' } });
    const contents = res.ok ? await res.text() : '';
    await route.fulfill({ status: res.ok ? 200 : res.status, contentType: 'application/json', body: JSON.stringify({ contents }) });
  });
  // file:// like the Electron window: the generators fall back to https://www.alanranger.com for ids when the
  // page URL is not http(s) (getBaseId), so an http origin here would change the output.
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.generateEventPostBundle === 'function' && typeof window.generateBlogIndexSchema === 'function', null, { timeout: 60000 });
  return page;
}

const COMMANDS = {
  'event-posts': async (page) => {
    await page.setInputFiles('#eventPostsLessonsCsvFile', path.join(CSV, '02-beginners-photography-lessons.csv'));
    await page.setInputFiles('#eventPostsWorkshopsCsvFile', path.join(CSV, '03-photographic-workshops-near-me.csv'));
    await page.setInputFiles('#eventPostsMappingsCsvFile', arg('--mappings') || path.join(WEB, 'alan-shared-resources', 'csv processed', '05-event-product-mappings-latest.csv'));
    const ok = await page.evaluate(() => generateEventPostBundle());
    if (!ok) throw new Error(await page.evaluate(() => document.getElementById('eventPostsOutput')?.textContent || 'generate failed'));
    await page.evaluate(() => deployEventPostBundle());
    return page.evaluate(() => document.getElementById('eventPostsOutput')?.textContent || '');
  },
  'blog-index': async (page) => {
    await page.setInputFiles('#blogCsvFile', path.join(CSV, '01-blog-posts.csv'));
    await page.waitForFunction(() => Array.isArray(blogPosts) && blogPosts.length > 0, null, { timeout: 30000 });
    await page.evaluate(() => generateBlogIndexSchema());
    if (!(await page.evaluate(() => !!window.currentBlogSchema))) throw new Error('blog index generate failed');
    await page.evaluate(() => exportAndDeployBlogSchema());
    return page.evaluate(() => (blogDebugLog || []).slice(-6).join('\n'));
  },
  landings: async (page) => {
    const only = arg('--paths');
    if (only) await page.evaluate((list) => { LANDING_HOSTED_PATHS.splice(0, LANDING_HOSTED_PATHS.length, ...list); }, only.split(','));
    await page.evaluate(() => regenerateAllLandingPages());
    await page.evaluate(() => deployLandingHostedSchemas());
    return page.evaluate(() => String(landingDebugLog || '').split('\n').slice(-8).join('\n'));
  }
};

async function main() {
  if (!COMMANDS[COMMAND]) throw new Error(`usage: app-cli.mjs <${Object.keys(COMMANDS).join('|')}> --out <dir>`);
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-web-security', '--allow-file-access-from-files'] });
  const t0 = Date.now();
  try {
    const page = await openApp(browser);
    const log = await COMMANDS[COMMAND](page);
    const report = { command: COMMAND, out: OUT, seconds: Math.round((Date.now() - t0) / 1000), files_written: writes.length, files: writes, log };
    fs.writeFileSync(path.join(OUT, 'app-cli-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ command: COMMAND, files_written: writes.length, seconds: report.seconds }));
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
