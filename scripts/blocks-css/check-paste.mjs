#!/usr/bin/env node
/**
 * Pre-paste check for Squarespace code blocks (Alan 4 Nov): Squarespace blanks any CSS rule whose body has no
 * whitespace once trimmed (e.g. "{display:flex}") when the page is saved.
 *   node scripts/blocks-css/check-paste.mjs <file.html ...>         → lists those rules; exit 1 if any
 *   node scripts/blocks-css/check-paste.mjs <file.html ...> --fix   → rewrites each <style> as "prop: value" (in place)
 * Generators: import { formatForSquarespace } and pass every <style> body through it before writing a paste file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

/** Rules Squarespace would blank: body with no whitespace once trimmed. */
export const blankable = (css) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{};]+)\{([^{}]*)\}/g)]
  .filter((m) => m[2].trim() && !/\s/.test(m[2].trim()) && !m[1].trim().startsWith('@')).map((m) => `${m[1].trim()}{${m[2].trim()}}`);

/** Every declaration written "prop: value" (space after the colon), so every rule body holds whitespace. */
export function formatForSquarespace(css) {
  const root = postcss.parse(css);
  root.walkDecls((d) => { d.raws.between = ': '; });
  root.walkRules((r) => { if (r.nodes?.length) { r.raws.between = ' '; r.raws.after = ' '; r.nodes[0].raws.before = ' '; } });
  return root.toString();
}

export const fixHtml = (html) => html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, a, css, b) => `${a}${formatForSquarespace(css)}${b}`);

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const fix = process.argv.includes('--fix');
  let bad = 0;
  for (const f of process.argv.slice(2).filter((a) => !a.startsWith('--'))) {
    const html = fs.readFileSync(f, 'utf8');
    const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    const before = blankable(css);
    if (fix && before.length) {
      const fixed = fixHtml(html);
      fs.writeFileSync(f, fixed);
      const after = blankable([...fixed.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n'));
      console.log(`${f}: fixed ${before.length} rule(s); ${after.length} left`);
      bad += after.length;
    } else {
      console.log(`${f}: ${before.length ? `${before.length} rule(s) Squarespace would blank, e.g. ${before[0].slice(0, 80)}` : 'OK'}`);
      bad += before.length;
    }
  }
  process.exit(bad ? 1 : 0);
}
