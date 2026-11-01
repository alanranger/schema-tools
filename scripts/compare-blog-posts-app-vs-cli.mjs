#!/usr/bin/env node
/**
 * Proof for the live blog-posts step: the installed desktop app's Blog Posts tab (single-URL generate with
 * "Save to GitHub" OFF, so it writes nothing) and the CLI used by BAU Monthly produce byte-identical files.
 * The app's schemas are captured as each passes validateSchema (the same object then serialised with indent 2).
 * The app's run report to AI GEO Audit is intercepted, never sent.
 *   node scripts/compare-blog-posts-app-vs-cli.mjs --out <dir> --slugs a,b,c
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { packagedMatchesSource, savedSettingsMatch, withDesktopApp } from './lib/desktop-app.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (flag, fallback) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : fallback; };
const OUT = path.resolve(arg('--out', path.join(ROOT, 'outputs', 'blog-posts-proof')));
const SLUGS = String(arg('--slugs', '')).split(',').filter(Boolean);
const SUFFIX = { WebPage: '_schema.json', BlogPosting: '_blogposting.json', BreadcrumbList: '_breadcrumb.json', HowTo: '_howto.json', FAQPage: '_faq.json', ImageObject: '_image.json' };

async function appRun(win, slug) {
  await win.evaluate((url) => {
    window.__captured = {};
    if (!window.__origValidate) window.__origValidate = window.validateSchema;
    window.validateSchema = (schema, type, s) => { window.__captured[type] = JSON.stringify(schema, null, 2); return window.__origValidate(schema, type, s); };
    document.getElementById('blogPostsTestUrl').value = url;
    document.getElementById('blogPostsSaveToGithub').checked = false;
  }, `https://www.alanranger.com/blog-on-photography/${slug}`);
  await win.evaluate(() => blogPosts_generateSingleUrl());
  return win.evaluate(() => window.__captured);
}

async function main() {
  if (!SLUGS.length) throw new Error('give --slugs a,b,c');
  const code = packagedMatchesSource(ROOT);
  if (!code.every((c) => c.identical)) throw new Error('packaged desktop app differs from source: rebuild it first');
  fs.mkdirSync(path.join(OUT, 'app'), { recursive: true });
  await withDesktopApp(async (win) => {
    await win.waitForFunction(() => typeof window.blogPosts_generateSingleUrl === 'function', null, { timeout: 60000 });
    if (!(await savedSettingsMatch(win, ROOT)).same) throw new Error('desktop app saved options differ from scripts/app-settings.json');
    await win.route('https://ai-geo-audit.vercel.app/api/aigeo/tool-run-report', (route) => route.fulfill({ status: 200, body: '{"ok":true,"proof":"not sent"}' }));
    for (const slug of SLUGS) {
      const captured = await appRun(win, slug);
      for (const [type, json] of Object.entries(captured)) if (SUFFIX[type]) fs.writeFileSync(path.join(OUT, 'app', `${slug}${SUFFIX[type]}`), json, 'utf8');
    }
  });
  const cli = spawnSync('node', ['scripts/app-cli.mjs', 'blog-posts', '--out', path.join(OUT, 'cli'), '--slugs', SLUGS.join(',')], { cwd: ROOT, encoding: 'utf8' });
  if (cli.status !== 0) throw new Error(`cli: ${cli.stderr || cli.stdout}`);
  const appFiles = fs.readdirSync(path.join(OUT, 'app')).sort();
  const cliFiles = fs.readdirSync(path.join(OUT, 'cli', 'alanranger-schema')).sort();
  const result = { same_file_set: JSON.stringify(appFiles) === JSON.stringify(cliFiles), files: appFiles.map((f) => ({ file: f,
    byte_identical: cliFiles.includes(f) && fs.readFileSync(path.join(OUT, 'app', f)).equals(fs.readFileSync(path.join(OUT, 'cli', 'alanranger-schema', f))) })) };
  fs.writeFileSync(path.join(OUT, 'blog-posts-app-vs-cli.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.same_file_set || !result.files.every((f) => f.byte_identical)) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
