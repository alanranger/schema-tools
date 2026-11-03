/**
 * The one path that publishes schema files to schema.alanranger.com (GitHub Pages from alanranger-schema):
 * stage in batches → one commit → push. Used by the Schema Tools app's batch-deploy handler and by the
 * BAU Monthly runner's live stages, so both publish the same way.
 *
 * Options:
 *   expectExact — the commit must contain exactly these files (`git diff --name-only HEAD^ HEAD`), else the
 *                 commit is dropped (working tree kept) and nothing is pushed;
 *   restoreOnAbort — runner only: on a dropped commit, its own written files go back to HEAD;
 *   assertClean() — runner only: refuse if the repo has uncommitted changes before the stage writes.
 * undoCommit() restores the parent versions of exactly one commit's files, as its own commit, through the same path.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ADD_BATCH = 50;
const INDEX_RETRIES = 3;

export const GIT_INDEX_WRITE_HINT =
  ' Fixes: pause Dropbox/OneDrive on Schema Tools/alanranger-schema, close other Git tools, free disk space, delete alanranger-schema/.git/index.lock only if no git process is running, then retry.';

export function git(repo, args) {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], shell: false });
  return { code: r.status ?? -1, stdout: r.stdout || '', stderr: r.stderr || (r.error ? String(r.error) : '') };
}

const lines = (s) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function ensureGitOnBranch(repo, branch = 'main') {
  const current = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
  if (current && current !== 'HEAD') return;
  const co = git(repo, ['checkout', branch]);
  if (co.code !== 0) throw new Error(`Failed to checkout branch "${branch}" in ${repo}: ${(co.stderr || co.stdout).trim() || 'unknown error'}`);
}

export function removeStaleGitIndexLock(repo) {
  const lock = path.join(repo, '.git', 'index.lock');
  if (!fs.existsSync(lock)) return false;
  try { fs.unlinkSync(lock); return true; } catch { return false; }
}

const indexWriteFailed = (r) => `${r.stderr}${r.stdout}`.toLowerCase().includes('unable to write new index file');
const onlyWarnings = (r) => /LF will be replaced by CRLF|CRLF will be replaced by LF|warning:/.test(r.stderr)
  && !/error:|fatal:/i.test(r.stderr);
const nothingToCommit = (r) => /nothing to commit|working tree clean/.test(`${r.stderr}${r.stdout}`);

/** One git step with the app's tolerance: warnings-only exit 1 is ok; an index write failure retries after removing a stale lock. */
function gitStep(repo, args, desc) {
  for (let attempt = 0; ; attempt += 1) {
    const r = git(repo, args);
    if (r.code === 0 || (r.code === 1 && onlyWarnings(r))) return r;
    if (args[0] === 'commit' && r.code === 1 && nothingToCommit(r)) return { ...r, nothing: true };
    if (indexWriteFailed(r) && attempt < INDEX_RETRIES) {
      removeStaleGitIndexLock(repo);
      sleep(800);
      continue;
    }
    const base = `Git ${desc} failed with code ${r.code}: ${r.stderr || r.stdout}`;
    throw new Error(indexWriteFailed(r) ? `${base}${GIT_INDEX_WRITE_HINT}` : base);
  }
}

function sameSet(a, b) {
  const sb = [...b].sort();
  return a.length === b.length && [...a].sort().every((x, i) => x === sb[i]);
}

/**
 * Drops the commit just made and explains why. A mixed reset keeps every working-tree change (nobody's
 * pending work is lost); `restore` files (the runner's own writes) go back to HEAD.
 */
function abortCommit(repo, expected, actual, restore) {
  git(repo, ['reset', '-q', '--mixed', 'HEAD^']);
  if (restore.length) git(repo, ['checkout', 'HEAD', '--', ...restore]);
  const extra = actual.filter((f) => !expected.includes(f));
  const missing = expected.filter((f) => !actual.includes(f));
  throw new Error(`Commit did not match the publish list (extra: ${extra.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'}); commit dropped, nothing pushed`);
}

export function assertClean(repo) {
  const dirty = lines(git(repo, ['status', '--porcelain']).stdout);
  if (dirty.length) throw new Error(`The schema repo has uncommitted changes (${dirty.slice(0, 5).join('; ')}); nothing was written`);
}

/**
 * Stage `files` (and deletions already made on disk) in batches, commit once, push once.
 * Returns { commit, nothing, files } — commit is the new SHA (null when there was nothing to commit).
 */
export function commitAndPush({ repo, files, message, branch = 'main', push = true, expectExact = false, restoreOnAbort = false }) {
  ensureGitOnBranch(repo, branch);
  removeStaleGitIndexLock(repo);
  const targets = [...new Set(files)];
  for (let i = 0; i < targets.length; i += ADD_BATCH) {
    gitStep(repo, ['add', '-A', '--', ...targets.slice(i, i + ADD_BATCH)], `Stage files (batch ${i / ADD_BATCH + 1})`);
  }
  const c = gitStep(repo, ['commit', '-m', message], 'Commit changes');
  if (c.nothing) return { commit: null, nothing: true, files: [] };
  const actual = lines(git(repo, ['diff', '--name-only', 'HEAD^', 'HEAD']).stdout);
  if (expectExact && !sameSet(actual, targets)) abortCommit(repo, targets, actual, restoreOnAbort ? targets.filter((f) => actual.includes(f)) : []);
  const commit = git(repo, ['rev-parse', 'HEAD']).stdout.trim();
  if (push) gitStep(repo, ['push'], 'Push to GitHub');
  return { commit, nothing: false, files: actual };
}

/** Files one commit changed, with status (A added, M modified, D deleted). */
export function commitFiles(repo, commit) {
  return lines(git(repo, ['diff-tree', '--no-commit-id', '--name-status', '-r', commit]).stdout)
    .map((l) => { const [status, ...rest] = l.split(/\s+/); return { status: status[0], file: rest.join(' ') }; });
}

/**
 * Undo one published commit: restore exactly its files to their parent versions (added files are removed,
 * deleted files come back), as a new commit pushed the same way. Refused if a later commit touched those files.
 */
export function undoCommit({ repo, commit, message, branch = 'main', push = true }) {
  assertClean(repo);
  const changed = commitFiles(repo, commit);
  if (!changed.length) throw new Error(`Commit ${commit} changed no files`);
  const names = changed.map((c) => c.file);
  const later = lines(git(repo, ['log', '--format=%h', `${commit}..HEAD`, '--', ...names]).stdout);
  if (later.length) throw new Error(`Later commits (${later.join(', ')}) changed the same files; undo refused`);
  for (const c of changed) {
    if (c.status === 'A') fs.rmSync(path.join(repo, c.file), { force: true });
    else gitStep(repo, ['checkout', `${commit}^`, '--', c.file], `Restore ${c.file}`);
  }
  return commitAndPush({ repo, files: names, message: message || `Undo ${commit.slice(0, 8)}`, branch, push, expectExact: true, restoreOnAbort: true });
}
