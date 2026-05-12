/**
 * HowTo step extraction for blog articles — shared by the browser tool (dynamic import)
 * and Node regression tests. No third-party dependencies.
 */

function stripTags(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]+>/g, ' ');
}

function decodeBasicEntities(str) {
  if (!str) return '';
  return String(str)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function htmlBlockToPlainText(html) {
  if (!html) return '';
  let s = String(html);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<li[^>]*>/gi, '\n');
  s = stripTags(s);
  s = decodeBasicEntities(s);
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
  return s;
}

export function extractMainContentHtml(html) {
  if (!html) return '';
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return articleMatch[1];
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1];
  const contentMatch = html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (contentMatch) return contentMatch[1];
  const h1Match = html.indexOf('<h1');
  const h2Match = html.indexOf('<h2');
  const contentStart = Math.min(h1Match > 0 ? h1Match : html.length, h2Match > 0 ? h2Match : html.length);
  let mainContentHtml = html.substring(contentStart);
  const footerStart = Math.floor(mainContentHtml.length * 0.8);
  mainContentHtml = mainContentHtml.substring(0, footerStart);
  return mainContentHtml;
}

const HTML_ARTEFACT_RE = /<\/?|`\s*<p>|<a\s|<ul>|<li>|\\"|&lt;\/?[a-z]/i;
const QUESTION_START_RE = /^(What is|How do I|Why does)\b/i;

const SECTION_LABEL_RE =
  /^(how\s+to|steps|step\s*[-–—]?\s*by\s*[-–—]?\s*step|method|procedure)\b/i;

const IMPERATIVE_START_RE =
  /^(Set|Choose|Use|Adjust|Mount|Press|Open|Close|Select|Focus|Compose|Meter|Check|Switch|Connect|Activate|Position|Frame|Take|Capture|Review|Save|Export|Apply|Add|Remove|Increase|Decrease)\s+/i;
const STEP_HEADING_RE = /^step\s*\d+/i;
const NUM_PREFIX_HEADING_RE = /^\d+[\.)]\s+/;
/** Headings that read like FAQ questions, not procedural steps */
const FAQ_LIKE_HEADING_RE = /^(What|Why|When|Where|Which|Should|Can|Do|Does|Is|Are)\b/i;

function walkJsonLdNodes(node, visitor) {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((n) => walkJsonLdNodes(n, visitor));
    return;
  }
  if (typeof node !== 'object') return;
  visitor(node);
  if (node['@graph']) walkJsonLdNodes(node['@graph'], visitor);
}

function collectHowToStepsFromLd(node, bucket) {
  const types = node['@type'];
  const typeList = Array.isArray(types) ? types : [types];
  if (!typeList.some((t) => String(t || '').toLowerCase() === 'howto')) return;
  const raw = node.step;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    let name = item.name != null ? String(item.name) : '';
    let text = item.text != null ? String(item.text) : '';
    name = htmlBlockToPlainText(name).replace(/\s+/g, ' ').trim();
    text = htmlBlockToPlainText(text).trim();
    if (name || text) bucket.push({ name, text, position: typeof item.position === 'number' ? item.position : undefined });
  }
}

export function extractFromJsonLdHowTo(html) {
  const bucket = [];
  if (!html) return bucket;
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    const roots = Array.isArray(data) ? data : [data];
    for (const root of roots) walkJsonLdNodes(root, (n) => collectHowToStepsFromLd(n, bucket));
  }
  return bucket;
}

export function extractFromOrderedListSection(html) {
  const main = extractMainContentHtml(html) || html || '';
  const headingRe = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = headingRe.exec(main)) !== null) {
    const label = htmlBlockToPlainText(m[2]).replace(/\s+/g, ' ').trim();
    if (!SECTION_LABEL_RE.test(label)) continue;
    if (/\bfaqs?\b/i.test(label)) continue;
    const after = main.slice(m.index + m[0].length);
    const olMatch = after.match(/<ol[^>]*>([\s\S]*?)<\/ol>/i);
    if (!olMatch) continue;
    const lis = [...olMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
    const steps = [];
    for (const li of lis) {
      const full = htmlBlockToPlainText(li[1]).replace(/\s+/g, ' ').trim();
      if (!full) continue;
      const firstSentence = (full.split(/(?<=[.!?])\s+/)[0] || full).trim();
      let name = firstSentence.length > 80 ? `${firstSentence.slice(0, 77)}...` : firstSentence;
      steps.push({ name, text: full });
    }
    if (steps.length >= 3) return steps;
  }
  return [];
}

/**
 * Numbered <strong>N. …</strong> paragraphs after a procedure heading (Squarespace often has no <ol>).
 */
export function extractFromProcedureNumberedParagraphs(html) {
  const main = extractMainContentHtml(html) || html || '';
  const headingRe = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m;
  while ((m = headingRe.exec(main)) !== null) {
    const label = htmlBlockToPlainText(m[2]).replace(/\s+/g, ' ').trim();
    if (!SECTION_LABEL_RE.test(label)) continue;
    if (/\bfaqs?\b/i.test(label)) continue;
    const slice = main.slice(m.index + m[0].length, m.index + m[0].length + 20000);
    const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    const steps = [];
    let pm;
    while ((pm = pRe.exec(slice)) !== null) {
      const inner = pm[1];
      const qm = inner.match(/<strong>\s*\d+\.\s*([^<]+)<\/strong>/i);
      if (!qm) continue;
      const name = htmlBlockToPlainText(qm[1]).replace(/\s+/g, ' ').trim();
      const afterQ = inner.slice(inner.indexOf(qm[0]) + qm[0].length);
      const answerHtml = afterQ.replace(/^\s*(?:<br\s*\/?>)\s*/i, '');
      const text = htmlBlockToPlainText(answerHtml).replace(/\s+/g, ' ').trim();
      if (FAQ_LIKE_HEADING_RE.test(name.replace(NUM_PREFIX_HEADING_RE, '').trim())) continue;
      steps.push({ name, text });
    }
    if (steps.length >= 3) return steps;
  }
  return [];
}

export function extractFromImperativeHeadings(html) {
  const main = extractMainContentHtml(html) || html || '';
  const headingRe = /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi;
  const matches = [];
  let m;
  while ((m = headingRe.exec(main)) !== null) {
    matches.push({ level: +m[1], index: m.index, end: headingRe.lastIndex, inner: m[3] });
  }
  const steps = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const text = htmlBlockToPlainText(cur.inner).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (/\?\s*$/.test(text)) continue;
    const afterNumber = text.replace(NUM_PREFIX_HEADING_RE, '').trim();
    if (FAQ_LIKE_HEADING_RE.test(text) || FAQ_LIKE_HEADING_RE.test(afterNumber)) continue;
    const isImperative = IMPERATIVE_START_RE.test(text);
    const isStepHeading =
      STEP_HEADING_RE.test(text) ||
      (NUM_PREFIX_HEADING_RE.test(text) && IMPERATIVE_START_RE.test(afterNumber));
    if (!isImperative && !isStepHeading) continue;
    let endPos = main.length;
    for (let j = i + 1; j < matches.length; j++) {
      if (matches[j].level <= cur.level) {
        endPos = matches[j].index;
        break;
      }
    }
    const segment = main.slice(cur.end, endPos);
    if (/BlogItem-pagination|newsletter-form|sqs-block-newsletter/i.test(segment)) continue;
    const body = htmlBlockToPlainText(segment).replace(/\s+/g, ' ').trim();
    steps.push({ name: text, text: body || text });
  }
  return steps;
}

function trailingNamePunctuationOk(name) {
  const t = (name || '').trim();
  if (!t) return false;
  const last = t[t.length - 1];
  if (/[,:;!]/.test(last)) return false;
  return true;
}

export function validateHowToSteps(rawSteps, debugLog) {
  const dbg = typeof debugLog === 'function' ? debugLog : () => {};
  const seen = new Set();
  const out = [];
  for (const raw of rawSteps) {
    let name = (raw.name || '').replace(/\s+/g, ' ').trim();
    let text = (raw.text || '').replace(/\s+/g, ' ').trim();
    if (HTML_ARTEFACT_RE.test(name) || HTML_ARTEFACT_RE.test(text)) {
      dbg(`Step dropped: HTML or JSON artefact detected — ${name.slice(0, 60)}`);
      continue;
    }
    if (name.length < 5 || name.length > 120) {
      dbg(`Step dropped: name length ${name.length} — ${name.slice(0, 60)}`);
      continue;
    }
    if (text.length < 20 || text.length > 600) {
      dbg(`Step dropped: text length ${text.length} — ${name.slice(0, 60)}`);
      continue;
    }
    if (!trailingNamePunctuationOk(name)) {
      dbg(`Step dropped: name trailing punctuation invalid — ${name.slice(0, 60)}`);
      continue;
    }
    if (QUESTION_START_RE.test(text)) {
      dbg(`Step dropped: text reads like a FAQ question — ${name.slice(0, 60)}`);
      continue;
    }
    const qCount = (text.match(/\?/g) || []).length;
    if (qCount > 1) {
      dbg(`Step dropped: text has more than one question mark — ${name.slice(0, 60)}`);
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const position = typeof raw.position === 'number' && raw.position > 0 ? raw.position : undefined;
    out.push({ name, text, position });
  }
  return out;
}

/**
 * @param {string} html
 * @param {string} articleBody
 * @param {function|null} debugLog
 * @returns {{ strategy: string, steps: {name:string,text:string,position?:number}[], extractedCount: number, acceptedCount: number }}
 */
export function extractHowToFromArticle(html, articleBody = '', debugLog = null) {
  const dbg = typeof debugLog === 'function' ? debugLog : () => {};
  const sourceHtml = html || '';
  dbg(`HowTo extraction: HTML length ${sourceHtml.length}, articleBody length ${(articleBody || '').length}`);

  if (!sourceHtml.trim() && !(articleBody || '').trim()) {
    dbg('HowTo extraction: aborted — empty HTML and article body');
    return { strategy: 'none', steps: [], extractedCount: 0, acceptedCount: 0 };
  }

  const primaryHtml = sourceHtml.trim() ? sourceHtml : '';

  const run = (label, raw) => {
    const extractedCount = raw.length;
    const steps = validateHowToSteps(raw, dbg);
    dbg(`${label}: ${extractedCount} raw step(s), ${steps.length} passed validation`);
    if (steps.length >= 3) {
      dbg(
        `${label} succeeded (preview step: ${steps[0].name.slice(0, 80)}${steps[0].name.length > 80 ? '…' : ''})`
      );
      return { strategy: label, steps, extractedCount, acceptedCount: steps.length };
    }
    return null;
  };

  let r = run('A', extractFromJsonLdHowTo(primaryHtml));
  if (r) return r;
  r = run('B', extractFromOrderedListSection(primaryHtml));
  if (r) return r;
  r = run('B-paragraphs', extractFromProcedureNumberedParagraphs(primaryHtml));
  if (r) return r;
  r = run('C', extractFromImperativeHeadings(primaryHtml));
  if (r) return r;

  dbg('HowTo extraction: no strategy returned 3+ valid steps');
  return { strategy: 'none', steps: [], extractedCount: 0, acceptedCount: 0 };
}
