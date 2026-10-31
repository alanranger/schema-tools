/**
 * Per-event item JSON (holds the body that the export's Text_Block comes from). Paced 6s.
 */
import fs from 'node:fs';
import path from 'node:path';
import { FEEDS, ORIGIN, readFeed, fetchText, sleep } from './lib.mjs';

const out = {};
const outFile = path.join(FEEDS, 'event-items.json');
if (fs.existsSync(outFile)) Object.assign(out, JSON.parse(fs.readFileSync(outFile, 'utf8')));
let n = 0;
for (const slug of ['beginners-photography-lessons', 'photographic-workshops-near-me']) {
  const f = readFeed(slug);
  for (const ev of [...f.upcoming, ...f.past]) {
    if (out[ev.fullUrl]) continue;
    const j = JSON.parse(await fetchText(`${ORIGIN}${ev.fullUrl}?format=json`));
    out[ev.fullUrl] = { body: j.item?.body || '', updatedOn: j.item?.updatedOn };
    n += 1;
    if (n % 10 === 0) { fs.writeFileSync(outFile, JSON.stringify(out)); console.log(`${n} fetched`); }
    await sleep(6000);
  }
}
fs.writeFileSync(outFile, JSON.stringify(out));
console.log(`done: ${Object.keys(out).length} event items`);
