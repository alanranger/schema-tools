#!/usr/bin/env node

/**
 * Build FAQ-AUDIT.csv from the latest 308-URL bulk regen run in BULK-REGEN-LOG.md.
 *
 * Reads, in order:
 *   - BULK-REGEN-LOG.md           — per-URL outcomes and strategies for the most recent run.
 *   - alanranger-schema/{slug}_blogposting.json  — for headline (falls back to *_schema.json).
 *   - alanranger-schema/{slug}_faq.json          — content scan for legacy mediocre signatures.
 *
 * Writes:
 *   - FAQ-AUDIT.csv               (sorted by priority then slug)
 *   - FAQ-AUDIT-WARNINGS.md       (only when ambiguous log lines are encountered)
 *
 * Strictly read-only against alanranger-schema; produces no schema changes.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const repo = path.join(root, 'alanranger-schema');
const logPath = path.join(root, 'BULK-REGEN-LOG.md');
const csvPath = path.join(root, 'FAQ-AUDIT.csv');
const warningsPath = path.join(root, 'FAQ-AUDIT-WARNINGS.md');

const PRIORITY_KEYWORDS = [
  'tips',
  'guide',
  'how-to',
  'rules',
  'tricks',
  'mistakes',
  'principles',
  'checklist',
  'assignment'
];

const LEGACY_FAQ_SIGNATURES = [
  'minimize',
  'colors',
  'Beginners should use',
  'optimum',
  'various lighting conditions',
  'range of techniques',
  'experiment with'
];

const URL_LINE_RE =
  /^(?<ts>\S+)\s+(?<slug>[a-z0-9][a-z0-9-]*)\s+howto=(?<hStrat>[A-Za-z-]+)\/(?<hSteps>\d+)\s+faq=(?<fStrat>[A-Za-z-]+)\/(?<fPairs>\d+)\s+files=(?<hRes>[a-z-]+),(?<fRes>[a-z-]+)\s*$/;
const ERROR_LINE_RE = /^(?<ts>\S+)\s+(?<slug>[a-z0-9][a-z0-9-]*)\s+ERROR\s+(?<msg>.+)$/;

function readLogLatestRun() {
  const raw = fs.readFileSync(logPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  let startIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('Starting bulk HowTo/FAQ regen: 308 URL(s)')) {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) throw new Error('Could not find a 308-URL bulk run in BULK-REGEN-LOG.md');
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/Finished bulk HowTo\/FAQ regen \(308 URL/.test(lines[i])) {
      endIdx = i + 1;
      break;
    }
  }
  return lines.slice(startIdx, endIdx);
}

function parseLog(logLines) {
  const rows = new Map();
  const warnings = [];
  for (const line of logLines) {
    if (!line.trim()) continue;
    if (line.includes('Starting bulk HowTo/FAQ regen')) continue;
    if (line.includes('Finished bulk HowTo/FAQ regen')) continue;
    if (line.includes('Batch ') && line.includes('committed and pushed.')) continue;
    if (line.includes('Batch ') && line.includes('no file changes')) continue;
    if (line.includes('Halted:')) continue;
    if (line.includes('git failed')) continue;

    const urlMatch = line.match(URL_LINE_RE);
    if (urlMatch && urlMatch.groups) {
      const g = urlMatch.groups;
      rows.set(g.slug, {
        slug: g.slug,
        howtoOutcome: g.hRes,
        howtoStrategy: g.hStrat,
        howtoStepCount: Number(g.hSteps),
        faqOutcome: g.fRes,
        faqStrategy: g.fStrat,
        faqPairCount: Number(g.fPairs),
        isError: false
      });
      continue;
    }
    const errMatch = line.match(ERROR_LINE_RE);
    if (errMatch && errMatch.groups) {
      const g = errMatch.groups;
      rows.set(g.slug, {
        slug: g.slug,
        howtoOutcome: '',
        howtoStrategy: '',
        howtoStepCount: 0,
        faqOutcome: '',
        faqStrategy: '',
        faqPairCount: 0,
        isError: true,
        errorMessage: g.msg.trim()
      });
      continue;
    }
    warnings.push(line);
  }
  return { rows, warnings };
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function headlineFromBlogposting(slug) {
  const file = path.join(repo, `${slug}_blogposting.json`);
  const doc = safeReadJson(file);
  if (!doc) return '';
  if (typeof doc.headline === 'string' && doc.headline.trim()) return doc.headline.trim();
  if (typeof doc.name === 'string' && doc.name.trim()) return doc.name.trim();
  return '';
}

function headlineFromSchema(slug) {
  const file = path.join(repo, `${slug}_schema.json`);
  const doc = safeReadJson(file);
  if (!doc) return '';
  if (typeof doc.name === 'string' && doc.name.trim()) return doc.name.trim();
  if (Array.isArray(doc['@graph'])) {
    for (const node of doc['@graph']) {
      if (!node) continue;
      const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
      if (types.includes('WebPage') && typeof node.name === 'string') return node.name.trim();
      if (types.includes('BlogPosting') && typeof node.headline === 'string') return node.headline.trim();
    }
  }
  return '';
}

function resolveHeadline(slug) {
  const fromBp = headlineFromBlogposting(slug);
  if (fromBp) return fromBp;
  return headlineFromSchema(slug);
}

function faqJsonContainsLegacySignature(slug) {
  const file = path.join(repo, `${slug}_faq.json`);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return false;
  }
  for (const sig of LEGACY_FAQ_SIGNATURES) {
    if (text.includes(sig)) return true;
  }
  return false;
}

function slugMatchesPriorityKeywords(slug) {
  for (const kw of PRIORITY_KEYWORDS) {
    if (slug.includes(kw)) return true;
  }
  return false;
}

function deriveFaqSkipReason(row) {
  if (row.isError) return 'extraction-error';
  if (row.faqOutcome === 'ok-faq') return '';
  if (row.faqOutcome === 'delete-faq' || row.faqOutcome === 'skip-faq') {
    if (row.faqPairCount === 0) return 'no-on-page-faq';
    if (row.faqPairCount > 0 && row.faqPairCount < 3) return 'under-3-pairs';
    return '';
  }
  return '';
}

function derivePriority(row) {
  if (row.faqOutcome === 'ok-faq') {
    if (row.faqStrategy === 'A' && faqJsonContainsLegacySignature(row.slug)) return 'medium';
    return 'low';
  }
  if (row.faqOutcome === 'skip-faq' || row.faqOutcome === 'delete-faq') {
    if (slugMatchesPriorityKeywords(row.slug)) return 'high';
    if (row.slug.startsWith('what-is-')) return 'medium';
    return 'low';
  }
  return 'low';
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function priorityRank(p) {
  if (p === 'high') return 0;
  if (p === 'medium') return 1;
  return 2;
}

function buildCsv(rows, sourceSha) {
  const sorted = rows.slice().sort((a, b) => {
    const r = priorityRank(a.faq_priority) - priorityRank(b.faq_priority);
    if (r !== 0) return r;
    return a.slug.localeCompare(b.slug);
  });

  const counts = {
    total: rows.length,
    okFaq: rows.filter((r) => r.faq_outcome === 'ok-faq').length,
    skipFaq: rows.filter((r) => r.faq_outcome === 'skip-faq').length,
    deleteFaq: rows.filter((r) => r.faq_outcome === 'delete-faq').length,
    okHowto: rows.filter((r) => r.howto_outcome === 'ok-howto').length,
    skipHowto: rows.filter((r) => r.howto_outcome === 'skip-howto').length,
    high: rows.filter((r) => r.faq_priority === 'high').length,
    medium: rows.filter((r) => r.faq_priority === 'medium').length,
    low: rows.filter((r) => r.faq_priority === 'low').length
  };

  const generatedAt = new Date().toISOString();
  const header = [
    '# FAQ Audit — Alan Ranger Blog Schema',
    `# Generated: ${generatedAt}`,
    `# Source: BULK-REGEN-LOG.md commit ${sourceSha}`,
    '#',
    '# Counts:',
    `# Total articles: ${counts.total}`,
    `# ok-faq: ${counts.okFaq}`,
    `# skip-faq: ${counts.skipFaq}`,
    `# delete-faq: ${counts.deleteFaq}`,
    `# ok-howto: ${counts.okHowto}`,
    `# skip-howto: ${counts.skipHowto}`,
    '#',
    '# Priority breakdown (FAQ):',
    `# high: ${counts.high}  (skip-faq on tips/guide/how-to articles — biggest rewrite wins)`,
    `# medium: ${counts.medium}  (skip-faq on definition articles, OR ok-faq with legacy content signatures)`,
    `# low: ${counts.low}  (already has good content, or unlikely to benefit)`,
    '#'
  ].join('\n');

  const columns = [
    'slug',
    'url',
    'headline',
    'faq_outcome',
    'faq_strategy',
    'faq_pair_count',
    'faq_skip_reason',
    'faq_priority',
    'howto_outcome',
    'howto_strategy',
    'howto_step_count'
  ];
  const dataLines = [columns.join(',')];
  for (const r of sorted) {
    dataLines.push(
      [
        r.slug,
        r.url,
        r.headline,
        r.faq_outcome,
        r.faq_strategy,
        r.faq_pair_count,
        r.faq_skip_reason,
        r.faq_priority,
        r.howto_outcome,
        r.howto_strategy,
        r.howto_step_count
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  return { content: `${header}\n${dataLines.join('\n')}\n`, counts, sorted };
}

function main() {
  const sourceSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();
  const logLines = readLogLatestRun();
  const { rows, warnings } = parseLog(logLines);

  const enriched = [];
  for (const r of rows.values()) {
    const url = `https://www.alanranger.com/blog-on-photography/${r.slug}`;
    const headline = resolveHeadline(r.slug);
    const faqStrategy = r.faqStrategy === 'none' ? 'none' : r.faqStrategy;
    const howtoStrategy = r.howtoStrategy === 'none' ? 'none' : r.howtoStrategy;
    const enrichedRow = {
      slug: r.slug,
      url,
      headline,
      faq_outcome: r.faqOutcome,
      faq_strategy: faqStrategy,
      faq_pair_count: r.faqPairCount,
      faq_skip_reason: deriveFaqSkipReason(r),
      faq_priority: 'low',
      howto_outcome: r.howtoOutcome,
      howto_strategy: howtoStrategy,
      howto_step_count: r.howtoStepCount
    };
    enrichedRow.faq_priority = derivePriority({
      ...r,
      faqOutcome: enrichedRow.faq_outcome,
      faqStrategy: enrichedRow.faq_strategy,
      slug: r.slug
    });
    enriched.push(enrichedRow);
  }

  const { content, counts, sorted } = buildCsv(enriched, sourceSha);
  fs.writeFileSync(csvPath, content, 'utf8');

  if (warnings.length) {
    const md = [
      '# FAQ Audit — log parser warnings',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Source: BULK-REGEN-LOG.md commit ${sourceSha}`,
      '',
      `Total ambiguous lines: ${warnings.length}`,
      '',
      '## Lines',
      '',
      '```',
      ...warnings,
      '```',
      ''
    ].join('\n');
    fs.writeFileSync(warningsPath, md, 'utf8');
  } else if (fs.existsSync(warningsPath)) {
    fs.unlinkSync(warningsPath);
  }

  const preview = (level) =>
    sorted
      .filter((r) => r.faq_priority === level)
      .slice(0, 5)
      .map((r) => `  ${r.slug} faq=${r.faq_outcome}/${r.faq_strategy}/${r.faq_pair_count}`)
      .join('\n');

  console.log(`Wrote ${csvPath}`);
  console.log(`Rows: ${counts.total}`);
  console.log(
    `FAQ: ok=${counts.okFaq} skip=${counts.skipFaq} delete=${counts.deleteFaq}; HowTo: ok=${counts.okHowto} skip=${counts.skipHowto}`
  );
  console.log(`Priority: high=${counts.high} medium=${counts.medium} low=${counts.low}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log('Preview (high):');
  console.log(preview('high') || '  (none)');
  console.log('Preview (medium):');
  console.log(preview('medium') || '  (none)');
  console.log('Preview (low):');
  console.log(preview('low') || '  (none)');
}

main();
