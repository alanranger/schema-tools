#!/usr/bin/env node
/**
 * Offline proof for carryForwardSelling (6.1): apply it to a dry run's 48 regenerated landing files, with the
 * published repo file as the hosted file, then run the BAU removal check. Nothing is written anywhere.
 *   node scripts/proof-landing-carry-forward.mjs [<dry run sandbox>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import './landing-live-sources.js';

const L = globalThis.LandingLiveSources;
const SANDBOX = process.argv[2] || 'C:/TEMP/update-all/a351ec0a-76c2-46b7-ba25-f4c7c4af3fc5';
const REPO = path.resolve('alanranger-schema');
const { checkPublishSet } = await import(pathToFileURL(path.resolve('../apps-dashboard/runner/removals.mjs')).href);

const out = path.join(SANDBOX, 'app-cli', 'landings', 'alanranger-schema');
const files = fs.readdirSync(out).filter((f) => f.endsWith('_landing_schema.json'));
const notes = JSON.parse(fs.readFileSync(path.join(SANDBOX, 'app-cli', 'landings', 'landing-diff-explain.json'), 'utf8')).rows;
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const fixed = {};
const carried = {};
for (const f of files) {
  const doc = read(path.join(out, f));
  const hosted = fs.existsSync(path.join(REPO, f)) ? read(path.join(REPO, f)) : null;
  carried[f] = L.carryForwardSelling(doc['@graph'], hosted);
  fixed[f] = doc;
}
const check = (docs) => checkPublishSet(files, { readBefore: (f) => (fs.existsSync(path.join(REPO, f)) ? read(path.join(REPO, f)) : null), readAfter: (f) => docs(f),
  contextFor: (f) => ({ stage: 'G', landingNote: (notes.find((r) => `${r.file}_landing_schema.json` === f)?.notes || []).join(' | ') }) });
const before = check((f) => read(path.join(out, f)));
const after = check((f) => fixed[f]);
const rated = Object.values(fixed).filter((d) => L.businessRatingNodes(d['@graph'])).length;
console.log(JSON.stringify({
  files: files.length,
  unexplained_before: { removals: before.unexplained.length, files: before.files_with_unexplained },
  unexplained_after: { removals: after.unexplained.length, files: after.files_with_unexplained, rows: after.unexplained.map((r) => `${r.file}: ${r.what}`) },
  business_rating_nodes_after: rated,
  carried: Object.fromEntries(Object.entries(carried).filter(([, v]) => v.length))
}, null, 2));
process.exitCode = after.unexplained.length === 0 && rated === 0 ? 0 : 1;
