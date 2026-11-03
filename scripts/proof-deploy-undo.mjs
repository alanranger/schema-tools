#!/usr/bin/env node
/**
 * Proof for scripts/lib/deploy-schemas.mjs on a THROWAWAY repo (never the live schema repo):
 * baseline (3 real schema files) → publish (2 changed + 1 new, from a dry run's sandbox) → undo → byte-identical,
 * plus: a commit with files outside the publish list is dropped and not pushed; undo is refused when a later
 * commit touched the same files.
 *   node scripts/proof-deploy-undo.mjs [--sandbox C:/TEMP/update-all/<dry run id>]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { git, commitAndPush, undoCommit, assertClean } from './lib/deploy-schemas.mjs';

const LIVE_REPO = 'G:/Dropbox/alan ranger photography/Website Code/Schema Tools/alanranger-schema';
const argSandbox = process.argv.indexOf('--sandbox');
const SANDBOX = argSandbox > 0 ? process.argv[argSandbox + 1] : 'C:/TEMP/update-all/a351ec0a-76c2-46b7-ba25-f4c7c4af3fc5';
const BASE_FILES = ['lessons-schema.json', 'home_landing_schema.json', 'blog-schema.json'];
const PUBLISH = [
  { file: 'lessons-schema.json', from: 'app-cli/event-index/alanranger-schema' },
  { file: 'home_landing_schema.json', from: 'app-cli/landings/alanranger-schema' },
  { file: 'about-alan-ranger_landing_schema.json', from: 'app-cli/landings/alanranger-schema' }
];

const sha = (f) => (fs.existsSync(f) ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') : null);
const must = (r, what) => { if (r.code !== 0) throw new Error(`${what}: ${r.stderr || r.stdout}`); return r.stdout.trim(); };
const snapshot = (work, names) => Object.fromEntries(names.map((n) => [n, sha(path.join(work, n))]));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); };

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bau-undo-proof-'));
  const remote = path.join(root, 'remote.git');
  const work = path.join(root, 'work');
  must(git(root, ['init', '--bare', '-b', 'main', remote]), 'init bare');
  must(git(root, ['clone', '-q', remote, work]), 'clone');
  must(git(work, ['config', 'user.email', 'proof@example.invalid']), 'config');
  must(git(work, ['config', 'user.name', 'deploy-undo proof']), 'config');
  must(git(work, ['config', 'core.autocrlf', 'false']), 'config');
  for (const f of BASE_FILES) fs.copyFileSync(path.join(LIVE_REPO, f), path.join(work, f));
  must(git(work, ['checkout', '-q', '-b', 'main']), 'branch');
  must(git(work, ['add', '-A']), 'add');
  must(git(work, ['commit', '-q', '-m', 'baseline']), 'commit');
  must(git(work, ['push', '-q', '-u', 'origin', 'main']), 'push');
  return { root, remote, work };
}

const remoteHead = (remote) => must(git(remote, ['rev-parse', 'main']), 'remote head');
const tree = (repo, ref) => must(git(repo, ['rev-parse', `${ref}^{tree}`]), 'tree');

function proofPublishUndo({ remote, work }) {
  const names = [...new Set([...BASE_FILES, ...PUBLISH.map((p) => p.file)])];
  const before = snapshot(work, names);
  const baseTree = tree(work, 'HEAD');
  assertClean(work);
  for (const p of PUBLISH) fs.copyFileSync(path.join(SANDBOX, p.from, p.file), path.join(work, p.file));
  const pub = commitAndPush({ repo: work, files: PUBLISH.map((p) => p.file), message: 'BAU proof: publish', expectExact: true });
  check('publish commit contains exactly the 3 publish files', pub.files.length === 3, pub.files.join(', '));
  check('publish reached the remote', remoteHead(remote) === pub.commit, pub.commit);
  check('published bytes = sandbox bytes', PUBLISH.every((p) => sha(path.join(work, p.file)) === sha(path.join(SANDBOX, p.from, p.file))));
  const undo = undoCommit({ repo: work, commit: pub.commit, message: 'BAU proof: undo' });
  const after = snapshot(work, names);
  check('undo commit contains exactly the same 3 files', undo.files.length === 3, undo.files.join(', '));
  check('after undo every file is byte-identical to before (sha256), the new file is gone',
    names.every((n) => before[n] === after[n]), JSON.stringify(Object.fromEntries(names.map((n) => [n, `${String(before[n]).slice(0, 8)}→${String(after[n]).slice(0, 8)}`]))));
  check('after undo the repo tree is identical to the baseline tree', tree(work, 'HEAD') === baseTree, baseTree);
  check('the remote has the undo and the same tree', remoteHead(remote) === undo.commit && tree(remote, 'main') === baseTree);
}

function proofPurityAbort({ remote, work }) {
  const head = must(git(work, ['rev-parse', 'HEAD']), 'head');
  const remoteBefore = remoteHead(remote);
  fs.copyFileSync(path.join(SANDBOX, PUBLISH[0].from, PUBLISH[0].file), path.join(work, PUBLISH[0].file));
  let err = '';
  try { commitAndPush({ repo: work, files: [PUBLISH[0].file, 'blog-schema.json'], message: 'BAU proof: impure', expectExact: true }); } catch (e) { err = e.message; }
  check('a commit that does not match the publish list is refused', /did not match/.test(err), err);
  check('the refused commit was dropped locally and nothing was pushed',
    must(git(work, ['rev-parse', 'HEAD']), 'head') === head && remoteHead(remote) === remoteBefore && !git(work, ['status', '--porcelain']).stdout.trim());
  // Extra file: something already staged by someone else would ride along in the commit.
  fs.appendFileSync(path.join(work, 'blog-schema.json'), '\n');
  must(git(work, ['add', 'blog-schema.json']), 'pre-stage');
  fs.copyFileSync(path.join(SANDBOX, PUBLISH[0].from, PUBLISH[0].file), path.join(work, PUBLISH[0].file));
  let err2 = '';
  try { commitAndPush({ repo: work, files: [PUBLISH[0].file], message: 'BAU proof: extra', expectExact: true }); } catch (e) { err2 = e.message; }
  check('a commit carrying a file outside the publish list (pre-staged) is refused', /extra: blog-schema\.json/.test(err2), err2);
  check('…and nothing was pushed', remoteHead(remote) === remoteBefore);
}

function proofLaterCommitRefusal({ work }) {
  fs.copyFileSync(path.join(SANDBOX, PUBLISH[1].from, PUBLISH[1].file), path.join(work, PUBLISH[1].file));
  const pub = commitAndPush({ repo: work, files: [PUBLISH[1].file], message: 'BAU proof: publish 2', expectExact: true });
  fs.appendFileSync(path.join(work, PUBLISH[1].file), '\n');
  commitAndPush({ repo: work, files: [PUBLISH[1].file], message: 'later edit', expectExact: true });
  let err = '';
  try { undoCommit({ repo: work, commit: pub.commit }); } catch (e) { err = e.message; }
  check('undo is refused when a later commit changed the same file', /undo refused/.test(err), err);
}

/** The Schema Tools app's batch deploy calls commitAndPush without the runner extras: normal deploy + "nothing to commit". */
function proofAppMode({ remote, work }) {
  const f = BASE_FILES[2];
  const same = commitAndPush({ repo: work, files: [f], message: 'app: unchanged' });
  check('app mode: unchanged file → nothing to commit, no error', same.nothing === true && same.commit === null);
  fs.appendFileSync(path.join(work, f), '\n');
  const r = commitAndPush({ repo: work, files: [f], message: 'app: one file' });
  check('app mode: changed file → one commit pushed', !!r.commit && remoteHead(remote) === r.commit, r.commit);
}

const env = setup();
try {
  proofAppMode(env);
  proofPublishUndo(env);
  proofPurityAbort(env);
  proofLaterCommitRefusal(env);
} catch (e) {
  check('proof ran to the end', false, e.message);
}
const pass = results.every((r) => r.ok);
console.log(JSON.stringify({ pass, repo: env.root, live_repo_touched: false, results }, null, 2));
process.exitCode = pass ? 0 : 1;
