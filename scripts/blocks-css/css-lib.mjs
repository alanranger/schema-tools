// Shared helpers for the code-block CSS investigation (read-only).
import fs from 'node:fs';
import { Parser } from 'htmlparser2';

export function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '').trim();
  }
  return out;
}

/** Every <style> inside a Squarespace code block: { css, block (order on page), blockId (sqs block wrapper id), id (nearest id) }. */
export function codeStyles(html) {
  const out = []; const stack = []; let inStyle = null; let blockNo = 0;
  const p = new Parser({
    onopentag(name, a) {
      const code = /\b(sqs-code-container|sqs-block-code)\b/.test(a.class || '');
      if (code && !stack.some((s) => s.code)) blockNo += 1;
      stack.push({ name, code, id: a.id || null, cls: a.class || '' });
      if (name === 'style' && stack.some((s) => s.code)) inStyle = { css: '', block: blockNo };
    },
    ontext(t) { if (inStyle) inStyle.css += t; },
    onclosetag(name) {
      if (name === 'style' && inStyle) {
        const rev = [...stack].reverse();
        inStyle.id = rev.find((s) => s.id && s.name !== 'style')?.id || null;
        inStyle.blockId = rev.find((s) => s.id && /\bsqs-block\b/.test(s.cls))?.id || null;
        out.push(inStyle); inStyle = null;
      }
      stack.pop();
    },
  }, { decodeEntities: true });
  p.write(html); p.end();
  return out;
}

function chunks(css) {
  let s = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let prev;
  do { prev = s; s = s.replace(/\{[^{}]*\}/g, '\u0001'); } while (s !== prev);
  return s.split('\u0001').map((c) => c.trim()).filter(Boolean);
}
/** Blanked rules: a selector left with no body, glued to the next selector. */
export function strippedIn(css) {
  const out = [];
  for (const c of chunks(css)) {
    if (c.startsWith('@')) continue;
    const lines = c.split('\n').map((l) => l.trim()).filter(Boolean);
    const glued = lines.slice(0, -1).some((l, i) => !/[,(>+~]$/.test(l) && !/^[,)>+~]/.test(lines[i + 1]));
    const first = (c.match(/^[#.][\w-]+/) || [])[0];
    const esc = first && first.replace(/[.#]/g, '\\$&');
    const repeated = first && c.split(',').some((part) => (part.match(new RegExp(`${esc}(?![\\w-])`, 'g')) || []).length > 1);
    if (glued || repeated) out.push(c.replace(/\s+/g, ' ').slice(0, 140));
  }
  return out;
}
/** Intact rules Squarespace would blank on save (body has no whitespace once trimmed). */
export const atRisk = (css) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{};]+)\{([^{}]*)\}/g)]
  .filter((m) => m[2].trim() && !/\s/.test(m[2].trim()) && !m[1].trim().startsWith('@')).map((m) => `${m[1].trim().slice(-50)}{${m[2].trim().slice(0, 50)}}`);

export function pageSummary(html) {
  const styles = codeStyles(html);
  return { styles: styles.length, stripped: styles.reduce((a, s) => a + strippedIn(s.css).length, 0), at_risk: styles.reduce((a, s) => a + atRisk(s.css).length, 0) };
}
