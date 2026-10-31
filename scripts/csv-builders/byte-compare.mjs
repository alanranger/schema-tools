/**
 * Byte-for-byte compare: live CSV vs exact-copy test CSV, record by record.
 * Each differing row is classified: formatting (same values, different bytes), entity-only
 * (values equal once HTML entities are decoded), or genuine (content changed).
 */
import fs from 'node:fs';
import path from 'node:path';
import { LIVE_CSV, OUT, parseCsv, pathKey } from './lib.mjs';

// EXACT_DIR / ONLY / REPORT env vars select another test folder, one file and the report name.
const EXACT = process.env.EXACT_DIR || OUT;
const ALL_FILES = {
  '01-blog-posts.csv': 'Full Url', '02-beginners-photography-lessons.csv': 'Event_URL', '03-photographic-workshops-near-me.csv': 'Event_URL',
  '04-photography-services-courses-mentoring.csv': 'Full Url', '05-photo-workshops-uk-landscape.csv': 'Full Url',
  'raw-01-products-sqsp-export.csv': 'Variant ID [Non Editable]', '08-landing-and-service-pages.csv': 'url'
};
const FILES = process.env.ONLY ? { [process.env.ONLY]: ALL_FILES[process.env.ONLY] } : ALL_FILES;
const ENT = { pound: '£', quot: '"', middot: '·', times: '×', amp: '&', nbsp: '\u00a0', rsquo: '\u2019', ndash: '\u2013', mdash: '\u2014' };
const decode = (s) => String(s).replace(/&([a-z]+);/g, (m, n) => ENT[n] ?? m);

/** Split into raw record strings (quote-aware), keeping exact bytes. */
function rawRecords(text) {
  const out = [];
  let start = 0;
  let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') q = !q;
    if (!q && (c === '\n' || c === '\r')) {
      out.push(text.slice(start, i));
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      start = i + 1;
    }
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

function load(file) {
  const buf = fs.readFileSync(file);
  const bom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const text = buf.toString('utf8').replace(/^\uFEFF/, '');
  return { bom, text, records: rawRecords(text), parsed: parseCsv(text), eolCRLF: /\r\n/.test(text), trailing: /[\r\n]$/.test(text) };
}

function classify(liveVals, testVals) {
  if (liveVals.join('\u0001') === testVals.join('\u0001')) return 'formatting';
  if (liveVals.map(decode).join('\u0001') === testVals.map(decode).join('\u0001')) return 'entity-only';
  return 'genuine';
}

function compareFile(file, keyCol) {
  const L = load(path.join(LIVE_CSV, file));
  const T = load(path.join(EXACT, file));
  const hdr = L.parsed[0];
  const ki = hdr.indexOf(keyCol);
  const key = (vals) => (keyCol === 'Variant ID [Non Editable]' ? vals[ki] : pathKey(vals[ki]));
  const tByKey = new Map(T.parsed.slice(1).map((v, i) => [key(v), { vals: v, raw: T.records[i + 1] }]));
  const result = { file, header_identical: L.records[0] === T.records[0] && L.bom === T.bom, bom: `${L.bom}/${T.bom}`,
    eol: `${L.eolCRLF ? 'CRLF' : 'LF'}/${T.eolCRLF ? 'CRLF' : 'LF'}`, trailing_newline: `${L.trailing}/${T.trailing}`,
    rows: L.parsed.length - 1, identical: 0, formatting: [], 'entity-only': [], genuine: [], missing: [] };
  L.parsed.slice(1).forEach((vals, i) => {
    const t = tByKey.get(key(vals));
    if (!t) { result.missing.push(key(vals)); return; }
    if (L.records[i + 1] === t.raw) { result.identical += 1; return; }
    result[classify(vals, t.vals)].push(key(vals));
  });
  const order = (p) => p.slice(1).map((v) => key(v));
  const changed = new Set([...result.genuine, ...result['entity-only'], ...result.formatting, ...result.missing]);
  const liveOrder = order(L.parsed).filter((k) => tByKey.has(k) && !changed.has(k));
  const testOrder = order(T.parsed).filter((k) => liveOrder.includes(k));
  result.order_identical_unchanged_rows = liveOrder.join('|') === testOrder.join('|');
  result.whole_file_identical = fs.readFileSync(path.join(LIVE_CSV, file)).equals(fs.readFileSync(path.join(EXACT, file)));
  return result;
}

const report = Object.entries(FILES).map(([f, k]) => compareFile(f, k));
fs.writeFileSync(process.env.REPORT || path.join(EXACT, 'byte-compare-report.json'), JSON.stringify(report, null, 2));
for (const r of report) {
  console.log(`${r.file}: header=${r.header_identical} BOM=${r.bom} EOL=${r.eol} trailing=${r.trailing_newline} rows=${r.rows} identical=${r.identical} formatting=${r.formatting.length} entity-only=${r['entity-only'].length} genuine=${r.genuine.length} missing=${r.missing.length} order=${r.order_identical_unchanged_rows} wholeFile=${r.whole_file_identical}`);
  if (r.formatting.length) console.log('   formatting e.g.', r.formatting.slice(0, 3).join(' | '));
  if (r.genuine.length) console.log('   genuine e.g.', r.genuine.slice(0, 4).join(' | '));
}
