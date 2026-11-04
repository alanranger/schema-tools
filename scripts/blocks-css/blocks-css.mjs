/**
 * Hosted code-block stylesheet (Alan 4 Nov): one CSS file with every styled code block's CSS as designed, so a
 * Squarespace save that blanks a rule inside a block can't break the page. Each page's rules are scoped to that page
 * with :where(#<body id>) (zero specificity), and the file loads in the head, so the CSS still inside the blocks wins
 * every tie: pages that are fine stay identical; the hosted rules only fill what Squarespace blanked.
 */
import crypto from 'node:crypto';
import postcss from 'postcss';
import { codeStyles, strippedIn, atRisk } from './css-lib.mjs';

export const bodyIdOf = (html) => (html.match(/<body[^>]*\sid="([^"]+)"/) || [])[1] || null;
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);

/** postcss.parse, tolerating a dangling selector after the last "}" (a final rule Squarespace blanked). Null if unparseable. */
export function safeParse(css) {
  try { return postcss.parse(css); } catch { /* try without a dangling tail */ }
  const cut = css.lastIndexOf('}');
  const tail = css.slice(cut + 1);
  if (cut < 0 || tail.includes('{')) return null;
  try { return postcss.parse(css.slice(0, cut + 1)); } catch { return null; }
}

/** Normalised rule key "selector{prop:value;…}" (whitespace-insensitive) for matching a live block to its source. */
export function ruleKeys(css) {
  const keys = new Set();
  const root = safeParse(css);
  if (!root) return keys;
  root.walkRules((r) => {
    if (/\n/.test(r.selector) && !/,\s*\n/.test(r.selector)) return;
    const decls = [];
    r.walkDecls((d) => decls.push(`${d.prop}:${d.value}${d.important ? '!important' : ''}`.replace(/\s+/g, '')));
    keys.add(`${r.selector.replace(/\s+/g, ' ').trim()}{${decls.join(';')}}`);
  });
  return keys;
}

/** The blocks on one page, in page order, with their state. */
export function pageBlocks(url, html) {
  const bodyId = bodyIdOf(html);
  const perBlock = new Map();
  return codeStyles(html).map((s) => {
    const n = perBlock.get(s.block) || 0;
    perBlock.set(s.block, n + 1);
    return { url, bodyId, key: `${url}|${s.blockId || `block${s.block}`}|${n}`, blockId: s.blockId, id: s.id, css: s.css,
      stripped: strippedIn(s.css).length, atRisk: atRisk(s.css).length };
  });
}

/** :where(#a,#b) prefix; html / :root / body selectors keep pointing at the right element. */
function scopeSelector(sel, scopes) {
  const where = `:where(${scopes.map((s) => `#${s}`).join(',')})`;
  const s = sel.trim();
  const root = s.match(/^(html|:root)(?![\w-])(.*)$/i);
  if (root) {
    const body = root[2].match(/^\s*body(?![\w-])(.*)$/i);
    if (body) return `${root[1]} body${where}${body[1]}`;
    return `${root[1]}:where(:has(> ${scopes.map((x) => `body#${x}`).join(', > ')}))${root[2]}`;
  }
  const body = s.match(/^body(?![\w-])(.*)$/i);
  if (body) return `body${where}${body[1]}`;
  return `${where} ${s}`;
}

const KEEP_GLOBAL = /^(keyframes|-webkit-keyframes|font-face|charset)$/i;
const ROOTISH = /^(html|:root|body)(?![\w-])/i;
const hasRootish = (node) => {
  let found = false;
  if (node.type === 'rule') return node.selectors.some((s) => ROOTISH.test(s.trim()));
  node.walkRules?.((r) => { if (r.selectors.some((s) => ROOTISH.test(s.trim()))) found = true; });
  return found;
};
const compact = (s) => s.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}').trim();

/**
 * One block's CSS → normalised ("prop: value") and scoped to its page(s): ordinary rules nested once inside
 * :where(#page){ … } (CSS nesting; zero specificity), html / :root / body rules scoped explicitly, @keyframes and
 * @font-face kept global. Browsers without CSS nesting ignore the nested part (today's behaviour).
 */
export function scopeBlockCss(css, scopes) {
  const notes = [];
  const root = safeParse(css);
  if (!root) return { css: '', notes: ['UNPARSEABLE CSS: block left out'] };
  root.walkAtRules('import', (a) => { notes.push(`dropped @import ${a.params}`); a.remove(); });
  root.walkComments((c) => c.remove());
  root.walkDecls((d) => { d.raws.between = ': '; });
  const top = []; const nested = [];
  for (const node of root.nodes) {
    if (node.type === 'atrule' && KEEP_GLOBAL.test(node.name)) top.push(node.toString());
    else if (hasRootish(node)) {
      node.type === 'rule' ? (node.selectors = node.selectors.map((s) => scopeSelector(s, scopes))) : node.walkRules((r) => { r.selectors = r.selectors.map((s) => scopeSelector(s, scopes)); });
      top.push(node.toString());
    } else nested.push(node.toString());
  }
  const where = `:where(${scopes.map((s) => `#${s}`).join(',')})`;
  const out = [...top, nested.length ? `${where}{${nested.join('\n')}}` : ''].filter(Boolean).map(compact).join('\n');
  return { css: out, notes };
}

/** Group identical block CSS across pages (emitted once, scoped to every page that has it), in first-seen order. */
export function groupBlocks(blocks) {
  const groups = new Map();
  for (const b of blocks) {
    const h = hash(b.css.replace(/\s+/g, ' ').trim());
    if (!groups.has(h)) groups.set(h, { hash: h, css: b.css, scopes: [], keys: [] });
    const g = groups.get(h);
    if (b.bodyId && !g.scopes.includes(b.bodyId)) g.scopes.push(b.bodyId);
    g.keys.push(b.key);
  }
  return [...groups.values()].filter((g) => g.scopes.length);
}

/** Same selector with different declarations on different pages (resolved by page scoping; listed for the report). */
export function findClashes(blocks) {
  const bySel = new Map();
  for (const b of blocks) {
    for (const k of ruleKeys(b.css)) {
      const sel = k.slice(0, k.indexOf('{'));
      if (!bySel.has(sel)) bySel.set(sel, new Map());
      const m = bySel.get(sel);
      if (!m.has(k)) m.set(k, new Set());
      m.get(k).add(b.url.replace('https://www.alanranger.com', ''));
    }
  }
  return [...bySel.entries()].filter(([, m]) => m.size > 1 && new Set([...m.values()].flatMap((s) => [...s])).size > 1)
    .map(([sel, m]) => ({ selector: sel, variants: [...m.entries()].map(([k, pages]) => ({ rule: k.slice(k.indexOf('{')), pages: [...pages] })) }));
}

export function buildStylesheet(groups, version) {
  const head = `/* alanranger.com code-block styles — generated ${version}. Do not edit by hand: rebuilt from the live code blocks
   (and their paste files where Squarespace blanked rules). Each rule applies only on its own page(s). */\n`;
  const parts = [];
  const notes = [];
  for (const g of groups) {
    const out = scopeBlockCss(g.css, g.scopes);
    notes.push(...out.notes.map((n) => `${g.keys[0]}: ${n}`));
    if (out.css) parts.push(`/* ${g.keys[0].replace('https://www.alanranger.com', '')}${g.keys.length > 1 ? ` (+${g.keys.length - 1} identical)` : ''} */\n${out.css}`);
  }
  return { css: head + parts.join('\n\n') + '\n', notes };
}
