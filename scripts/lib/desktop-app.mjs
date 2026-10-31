/**
 * Drive the installed Schema Tools desktop app (SchemaTools.exe) for byte-compare proofs: start it with a DevTools
 * port and attach over CDP (Playwright's Electron launcher hangs on this Electron version). Generate-only callers.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

export const APP_DIR = path.join(process.env.LOCALAPPDATA, 'SchemaTools', 'SchemaTools-win32-x64');
const PACKAGED = path.join(APP_DIR, 'resources', 'app');

/** The packaged build must carry the same app code as the source the CLI loads. */
export function packagedMatchesSource(root) {
  return ['index.html', 'main.js', 'preload.js', 'scripts/landing-live-sources.js'].map((f) => ({ file: f,
    identical: fs.existsSync(path.join(PACKAGED, f)) && fs.readFileSync(path.join(PACKAGED, f)).equals(fs.readFileSync(path.join(root, f))) }));
}

/** The app's saved tab options must equal scripts/app-settings.json (what the CLI applies). */
export async function savedSettingsMatch(win, root) {
  const expected = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'app-settings.json'), 'utf8')).localStorage;
  const actual = await win.evaluate((keys) => Object.fromEntries(Object.keys(localStorage).filter((k) => !keys.ignore.includes(k)).map((k) => [k, localStorage.getItem(k)])),
    { ignore: ['validator.autoSave'] });
  const same = JSON.stringify(Object.entries(actual).sort()) === JSON.stringify(Object.entries(expected).sort());
  return { same, actual, expected };
}

export async function withDesktopApp(fn) {
  const port = 9400 + Math.floor(Math.random() * 500);
  const proc = spawn(path.join(APP_DIR, 'SchemaTools.exe'), [`--remote-debugging-port=${port}`], { stdio: 'ignore' });
  let browser = null;
  try {
    for (let i = 0; i < 60 && !browser; i += 1) {
      await new Promise((r) => setTimeout(r, 1000));
      const b = await chromium.connectOverCDP(`http://127.0.0.1:${port}`).catch(() => null);
      if (b && b.contexts().flatMap((c) => c.pages()).some((p) => p.url().endsWith('index.html'))) browser = b;
      else await b?.close().catch(() => {});
    }
    if (!browser) throw new Error('desktop app window not reachable on the DevTools port');
    const win = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().endsWith('index.html'));
    win.on('dialog', (d) => d.accept().catch(() => {}));
    return await fn(win);
  } finally {
    await browser?.close().catch(() => {});
    proc.kill();
  }
}
