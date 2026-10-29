#!/usr/bin/env node
/**
 * Apply the generator FAQ-omit step to hosted landing JSON.
 * Full Electron regenerate would rewrite WebPage/Service/Place via normalizeLandingSchemaOutput.
 * This pipeline only removes FAQPage + dangling #faq refs when the page has no visible FAQ.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LANDING_HOSTED_PATHS,
  LANDING_FAQ_KEEP,
  LANDING_FAQ_EXPECT_ZERO,
  landingFileName
} from './lib/landing-hosted-paths.mjs';
import {
  faqQuestionCount,
  graphWithoutFaq,
  stripLandingFaqOmit
} from './lib/strip-landing-faq.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.join(root, 'alanranger-schema');

function load(p) {
  const file = path.join(repo, landingFileName(p));
  return { file, schema: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

function main() {
  const stripped = [];
  const kept = [];
  const alreadyZero = [];

  for (const p of LANDING_HOSTED_PATHS) {
    const { file, schema } = load(p);
    const beforeFaq = faqQuestionCount(schema);
    const expectKeep = LANDING_FAQ_KEEP[p];
    const expectZero = LANDING_FAQ_EXPECT_ZERO.includes(p);

    if (expectKeep != null) {
      if (beforeFaq !== expectKeep) {
        throw new Error(`${p} KEEP expected ${expectKeep} got ${beforeFaq}`);
      }
      kept.push({ path: p, faq: beforeFaq });
      continue;
    }

    if (!expectZero) {
      if (beforeFaq !== 0) {
        throw new Error(`${p} expected 0 FAQ got ${beforeFaq}`);
      }
      alreadyZero.push(p);
      continue;
    }

    const beforeIds = graphWithoutFaq(schema).map((node) => node && node['@id']);
    const next = stripLandingFaqOmit(schema);
    const afterIds = (next['@graph'] || []).map((node) => node && node['@id']);
    if (JSON.stringify(beforeIds) !== JSON.stringify(afterIds)) {
      throw new Error(`${p} non-FAQ @id list changed`);
    }
    if (faqQuestionCount(next) !== 0) {
      throw new Error(`${p} FAQPage still present`);
    }
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n', 'utf8');
    stripped.push({ path: p, beforeFaq, afterFaq: 0, file: path.basename(file) });
  }

  const report = { stripped, kept, alreadyZero };
  const outPath = path.join(root, 'outputs', 'landing-faq-omit-2026-10-29.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`stripped=${stripped.length} kept=${kept.length} alreadyZero=${alreadyZero.length}`);
  stripped.forEach((row) => console.log(`  omit ${row.path} faq ${row.beforeFaq} -> 0`));
}

main();
