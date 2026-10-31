/**
 * Shared helpers for the CSV builders (exact copies of the Squarespace exports from live feeds / Commerce API).
 * Paths: CSV_BUILDERS_LIVE_CSV (the previous exports), CSV_BUILDERS_FEEDS (cached feed/API JSON, local only),
 * CSV_BUILDERS_OUT (where built CSVs are written — the Update-all sandbox in dry runs).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const LIVE_CSV = process.env.CSV_BUILDERS_LIVE_CSV || path.resolve(HERE, '..', '..', '..', 'alan-shared-resources', 'csv');
export const FEEDS = process.env.CSV_BUILDERS_FEEDS || path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'AlanCsvBuilders', 'feeds');
export const OUT = process.env.CSV_BUILDERS_OUT || path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'AlanCsvBuilders', 'out');
export const ORIGIN = 'https://www.alanranger.com';
const UA = 'Mozilla/5.0 (compatible; AlanCsvBuilders/1.0)';

export function parseCsv(text) {
  const t = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cur += '"'; i += 1; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).length));
}

export function readCsvObjects(file) {
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const header = rows[0];
  return { header, rows: rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))) };
}

export function esc(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function writeCsv(file, header, objects) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lines = [header.map(esc).join(',')];
  for (const o of objects) lines.push(header.map((h) => esc(o[h])).join(','));
  fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchText(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status !== 429) {
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return res.text();
    }
    await sleep(45000);
  }
  throw new Error(`429 ${url}`);
}

export function readFeed(name) {
  return JSON.parse(fs.readFileSync(path.join(FEEDS, `${name}.json`), 'utf8'));
}

export function pathKey(u) {
  try {
    const x = new URL(String(u || '').trim(), ORIGIN);
    return x.pathname.replace(/\/+$/, '').toLowerCase() || '/';
  } catch {
    return '';
  }
}

export function londonParts(ms) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const hour = p.hour === '24' ? '00' : p.hour;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${hour}:${p.minute}`, seconds: `${hour}:${p.minute}:${p.second}` };
}

export function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
