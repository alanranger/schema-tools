/**
 * FAQ extraction for blog articles — shared by the browser tool (dynamic import)
 * and Node regression tests. No third-party dependencies.
 */

const QUESTION_PREFIX_RE = /^(How|What|Why|When|Where|Which|Should|Can|Do|Does|Is|Are)\s+/i;
const CRUFT_PREFIX_RE = /^(read more|click here|learn more|find out more)\b/i;

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

function htmlBlockToPlainText(html) {
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

function collectMainEntityPairs(mainEntity, pairs) {
  const list = Array.isArray(mainEntity) ? mainEntity : mainEntity ? [mainEntity] : [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const q = item.name || item.text;
    const ans = item.acceptedAnswer;
    let text = '';
    if (typeof ans === 'string') text = ans;
    else if (ans && typeof ans === 'object') {
      const t = ans.text;
      text = Array.isArray(t) ? t.join('\n\n') : t || '';
    }
    if (q && text) pairs.push({ question: String(q).trim(), answer: String(text).trim() });
  }
}

function walkJsonLdNode(node, pairs) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((n) => walkJsonLdNode(n, pairs));
    return;
  }
  if (node['@graph']) walkJsonLdNode(node['@graph'], pairs);
  const types = node['@type'];
  const typeList = Array.isArray(types) ? types : [types];
  if (typeList.some((t) => String(t || '').toLowerCase() === 'faqpage')) {
    collectMainEntityPairs(node.mainEntity, pairs);
  }
}

export function extractFromJsonLdFaq(html) {
  const pairs = [];
  if (!html) return pairs;
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
    for (const root of roots) walkJsonLdNode(root, pairs);
  }
  return pairs;
}

export function extractFromSquarespaceFaqBlocks(html) {
  const pairs = [];
  if (!html) return pairs;
  const re =
    /<div[^>]*class="[^"]*summary-title[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*summary-description[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const question = htmlBlockToPlainText(m[1]).replace(/\s+/g, ' ').trim();
    const answer = htmlBlockToPlainText(m[2]).trim();
    pairs.push({ question, answer });
  }
  return pairs;
}

function findFaqSectionStart(html) {
  if (!html) return -1;
  const h2Faq = html.match(/<h2[^>]*>[\s\S]{0,220}?\bFAQs?\b/i);
  if (h2Faq && h2Faq.index != null) return h2Faq.index;
  const strongFaq = html.match(/<strong>\s*FAQs?\b/i);
  if (strongFaq && strongFaq.index != null) return strongFaq.index;
  const low = html.toLowerCase();
  const idx = low.indexOf('frequently asked questions');
  if (idx >= 0) return idx;
  return -1;
}

export function extractFromNumberedFaqParagraphs(fullHtml, mainHtml) {
  const pairs = [];
  const html = fullHtml || '';
  const start = findFaqSectionStart(html);
  if (start < 0) return pairs;
  const slice = html.slice(start, start + 25000);
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRe.exec(slice)) !== null) {
    const inner = m[1];
    const qm = inner.match(/<strong>\s*\d+\.\s*([^<]+?\?)\s*<\/strong>/i);
    if (!qm) continue;
    const question = stripTags(qm[1]).replace(/\s+/g, ' ').trim();
    const afterQ = inner.slice(inner.indexOf(qm[0]) + qm[0].length);
    const answerHtml = afterQ.replace(/^\s*(?:<br\s*\/?>)\s*/i, '');
    const answer = htmlBlockToPlainText(answerHtml);
    pairs.push({ question, answer });
  }
  return pairs;
}

function isQuestionHeadingText(text) {
  if (!text || text.length < 6) return false;
  const t = text.trim();
  if (t.endsWith('?')) return true;
  return QUESTION_PREFIX_RE.test(t);
}

export function extractFromQuestionHeadings(html) {
  const pairs = [];
  if (!html) return pairs;
  const headingRe = /<h([2-3])([^>]*)>([\s\S]*?)<\/h\1>/gi;
  const matches = [];
  let m;
  while ((m = headingRe.exec(html)) !== null) {
    matches.push({ level: +m[1], index: m.index, end: headingRe.lastIndex, inner: m[3] });
  }
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const text = stripTags(cur.inner).replace(/\s+/g, ' ').trim();
    if (!isQuestionHeadingText(text)) continue;
    if (/^faqs?\b/i.test(text) && !/\?\s*$/.test(text)) continue;
    let endPos = html.length;
    for (let j = i + 1; j < matches.length; j++) {
      if (matches[j].level <= cur.level) {
        endPos = matches[j].index;
        break;
      }
    }
    const segment = html.slice(cur.end, endPos);
    if (/BlogItem-pagination|newsletter-form|sqs-block-newsletter/i.test(segment)) continue;
    const answer = htmlBlockToPlainText(segment);
    pairs.push({ question: text, answer });
  }
  return pairs;
}

function validateQuestion(q) {
  const t = (q || '').replace(/\s+/g, ' ').trim();
  if (t.length < 10 || t.length > 300) return false;
  if (!t.endsWith('?')) return false;
  if ((t.match(/\?/g) || []).length !== 1) return false;
  if (t.includes('\n')) return false;
  const before = t.slice(0, -1);
  if (before.includes('. ')) return false;
  return true;
}

function validateAnswer(a, q) {
  if (!a) return false;
  if (/<script|<style/i.test(a)) return false;
  const t = a.trim();
  if (t.length < 30 || t.length > 1000) return false;
  if (CRUFT_PREFIX_RE.test(t)) return false;
  if (t.toLowerCase() === (q || '').toLowerCase()) return false;
  return true;
}

function normalizeAnswerWhitespace(a) {
  const lines = String(a).split('\n').map((line) => line.replace(/\s+/g, ' ').trim());
  return lines.filter(Boolean).join('\n\n').trim();
}

export function validateAndDedupePairs(pairs, debugLog) {
  const seen = new Set();
  const out = [];
  for (const raw of pairs) {
    let q = (raw.question || '').replace(/\s+/g, ' ').trim();
    let a = normalizeAnswerWhitespace(raw.answer || '');
    if (!validateQuestion(q)) {
      if (debugLog) debugLog(`Pair dropped: question failed validation — ${q.slice(0, 70)}`);
      continue;
    }
    if (!validateAnswer(a, q)) {
      if (debugLog) debugLog(`Pair dropped: answer failed validation — ${q.slice(0, 70)}`);
      continue;
    }
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ question: q, answer: a });
  }
  return out;
}

/**
 * @param {string} html
 * @param {string} articleBody
 * @param {function|null} debugLog
 * @returns {{ strategy: string, pairs: {question:string, answer:string}[], extractedCount: number, acceptedCount: number }}
 */
export function extractFAQFromArticle(html, articleBody = '', debugLog = null) {
  const dbg = (msg) => {
    if (typeof debugLog === 'function') debugLog(msg);
  };
  const sourceHtml = html || '';

  dbg(`FAQ extraction: HTML length ${sourceHtml.length}, articleBody length ${(articleBody || '').length}`);

  if (!sourceHtml.trim() && !(articleBody || '').trim()) {
    dbg('FAQ extraction: aborted — empty HTML and article body');
    return { strategy: 'none', pairs: [], extractedCount: 0, acceptedCount: 0 };
  }

  const primaryHtml = sourceHtml.trim() ? sourceHtml : '';
  const mainHtml = extractMainContentHtml(primaryHtml);

  const run = (strategyLabel, rawList) => {
    const extractedCount = rawList.length;
    const pairs = validateAndDedupePairs(rawList, dbg);
    dbg(`${strategyLabel}: ${extractedCount} raw pair(s), ${pairs.length} passed validation`);
    if (pairs.length >= 3) {
      dbg(
        `${strategyLabel} succeeded (preview question: ${pairs[0].question.slice(0, 96)}${pairs[0].question.length > 96 ? '…' : ''})`
      );
      return { strategy: strategyLabel, pairs, extractedCount, acceptedCount: pairs.length };
    }
    return null;
  };

  let r = run('A', extractFromJsonLdFaq(primaryHtml));
  if (r) return r;
  r = run('B', extractFromSquarespaceFaqBlocks(primaryHtml));
  if (r) return r;
  r = run('C', extractFromNumberedFaqParagraphs(primaryHtml, mainHtml));
  if (r) return r;
  r = run('C-headings', extractFromQuestionHeadings(mainHtml || primaryHtml));
  if (r) return r;

  dbg('FAQ extraction: no strategy returned 3+ valid pairs');
  return { strategy: 'none', pairs: [], extractedCount: 0, acceptedCount: 0 };
}
