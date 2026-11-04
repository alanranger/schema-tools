/**
 * Where a damaged block's CSS "as designed" comes from, in order:
 *   1. last known good: the previously published styles/blocks-sources.json (same page + block);
 *   2. the latest paste file in "03 Page Builds" holding every surviving rule of the block (a surviving rule may be
 *      blanked rules glued onto the next one — that is how Squarespace leaves them);
 *   3. the newest stored page snapshot (Supabase page_html + B / H backups) where the same block was intact.
 * Anything else is unconfirmed and left out of the fix (never guessed).
 */
import fs from 'node:fs';
import path from 'node:path';
import { codeStyles, strippedIn } from './css-lib.mjs';
import { ruleKeys } from './blocks-css.mjs';

export const PAGE_BUILDS = 'C:/Users/alan/Google Drive/Claude shared resources/03 Page Builds';
const sel = (k) => k.slice(0, k.indexOf('{')).replace(/\s+/g, '');
const body = (k) => k.slice(k.indexOf('{'));

/** A glued live rule = a run of consecutive source rules whose bodies were blanked, ending in the rule that kept its body. */
function gluedFrom(list, k) {
  for (let j = 0; j < list.length; j += 1) {
    if (body(list[j]) !== body(k)) continue;
    let s = sel(list[j]);
    for (let i = j - 1; i >= 0 && s.length < sel(k).length; i -= 1) {
      s = sel(list[i]) + s;
      if (s === sel(k)) return true;
    }
  }
  return false;
}
export function covers(keys, need) {
  const list = [...keys];
  return [...need].every((k) => keys.has(k) || gluedFrom(list, k));
}

/** Every <style> in every paste file under 03 Page Builds (BACKUP-* served copies skipped). */
export function pasteStyles(root = PAGE_BUILDS) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.html?$/i.test(e.name) && !/^BACKUP/i.test(e.name)) {
        for (const m of fs.readFileSync(p, 'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) out.push({ file: path.relative(root, p).replace(/\\/g, '/'), mtime: fs.statSync(p).mtimeMs, css: m[1], keys: ruleKeys(m[1]) });
      }
    }
  };
  walk(root);
  return out;
}

/** Supabase REST reader for stored page snapshots (or null when no credentials). */
export function snapshotReader(env) {
  if (!env?.MC_SUPABASE_URL || !env?.MC_SUPABASE_SERVICE_KEY) return null;
  const headers = { apikey: env.MC_SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.MC_SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' };
  const get = async (q, post) => (await fetch(`${env.MC_SUPABASE_URL}/rest/v1/${q}`, post ? { method: 'POST', headers, body: '{}' } : { headers })).json();
  let backups = null;
  return async (url) => {
    const v = [url, url.replace(/\/$/, '')].map((u) => `"${encodeURIComponent(u)}"`).join(',');
    backups ||= ((await get('rpc/bau_backup_inventory', true).catch(() => [])) || []).map((t) => t.table_name).filter((t) => /^bau_bk_\w+_page_html$/.test(t || ''));
    const tables = ['page_html', ...backups];
    const rows = [];
    for (const t of [...new Set(tables)]) rows.push(...((await get(`${t}?select=updated_at,html_content&url=in.(${v})`).catch(() => [])) || []));
    return rows.filter((r) => r?.html_content).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  };
}

/** The CSS as designed for one damaged block, or null. */
export async function resolveDamaged(block, { previous = {}, pastes = [], snapshots = null }) {
  const need = ruleKeys(block.css);
  const prev = previous[block.key];
  // Last known good keeps its original source label, so an unchanged block rebuilds byte-identically.
  if (prev?.css && covers(ruleKeys(prev.css), need)) return { css: prev.css, source: prev.source };
  const paste = pastes.filter((p) => need.size && p.keys.size > need.size && covers(p.keys, need)).sort((a, b) => b.mtime - a.mtime)[0];
  if (paste) return { css: paste.css, source: `paste ${paste.file}` };
  if (!snapshots) return null;
  for (const r of await snapshots(block.url)) {
    const hit = codeStyles(r.html_content).find((s) => s.blockId === block.blockId && !strippedIn(s.css).length && covers(ruleKeys(s.css), need) && s.css.length >= block.css.length * 0.9);
    if (hit) return { css: hit.css, source: `snapshot ${r.updated_at.slice(0, 16)}` };
  }
  return null;
}
