import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDamaged, squarespaceBlank, explains } from './sources.mjs';
import { ruleKeys } from './blocks-css.mjs';

const OLD = '#arp .card { color: red; }\n#arp .note { margin: 0; }\n';
// The new version adds rules written without spaces: a Squarespace save blanks exactly those.
const NEW = `${OLD}#arp .heading{display:flex}\n#arp .logo{width:72px}\n`;
const paste = (css, mtime) => ({ file: 'Blog Posts/x/01-STYLES.html', mtime, css, keys: ruleKeys(css) });
const block = { key: 'https://www.alanranger.com/x|block-arp|0', url: 'https://www.alanranger.com/x', blockId: 'block-arp', css: squarespaceBlank(NEW) };

test('the page CSS changed between two captures: the newer design is used, not the older last-known-good', async () => {
  assert.equal(explains(NEW, block.css), true);
  assert.equal(explains(OLD, block.css), false);
  const r = await resolveDamaged(block, { previous: { [block.key]: { css: OLD, source: 'live (intact)' } }, pastes: [paste(NEW, Date.now())] });
  assert.equal(r.css, NEW);
  assert.equal(r.source, 'paste Blog Posts/x/01-STYLES.html');
});

test('an unchanged block still rebuilds from its last-known-good, byte for byte', async () => {
  const damagedOld = { ...block, css: squarespaceBlank(NEW) };
  const r = await resolveDamaged(damagedOld, { previous: { [block.key]: { css: NEW, source: 'live (intact)' } }, pastes: [paste(NEW, Date.now())] });
  assert.deepEqual(r, { css: NEW, source: 'live (intact)' });
});

test('with no exact source, last-known-good that contains every surviving rule is still the fallback', async () => {
  const r = await resolveDamaged(block, { previous: { [block.key]: { css: OLD, source: 'live (intact)' } }, pastes: [] });
  assert.deepEqual(r, { css: OLD, source: 'live (intact)' });
});
