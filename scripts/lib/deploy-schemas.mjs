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

/** core.quotePath=false: git prints non-ASCII paths as-is ("03 – combined…"), not octal-escaped ("03 \342\200\223 …"). */
export function git(repo, args) {
  const r = spawnSync('git', ['-c', 'core.quotePath=false', ...args], { cwd: repo, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], shell: false });
  return { code: r.status ?? -1, stdout: r.stdout || '', stderr: r.stderr || (r.error ? String(r.error) : '') };
}

const lines = (s) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

/** A C-quoted git path ("a\tb", "\342\200\223") back to the real name. */
function unquoteGitPath(p) {
  if (!(p.length > 1 && p.startsWith('"') && p.endsWith('"'))) return p;
  const bytes = [];
  const body = p.slice(1, -1);
  const ESC = { n: 10, t: 9, r: 13, b: 8, f: 12, v: 11, a: 7, '"': 34, '\\': 92 };
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] !== '\\') { bytes.push(...Buffer.from(body[i], 'utf8')); continue; }
    const oct = body.slice(i + 1, i + 4);
    if (/^[0-7]{3}$/.test(oct)) { bytes.push(parseInt(oct, 8)); i += 3; } else { bytes.push(ESC[body[i + 1]] ?? body.charCodeAt(i + 1)); i += 1; }
  }
  return Buffer.from(bytes).toString('utf8');
}

/** One spelling per file for every comparison: unquoted, NFC, forward slashes. */
export const normPath = (p) => unquoteGitPath(String(p).trim()).normalize('NFC').replace(/\\/g, '/');
const pathLines = (s) => lines(s).map(normPath);
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
 * The caller's own writes go back: files in HEAD to their HEAD version, files new since HEAD are removed
 * (assertClean ran before the write, so nothing else was pending on these paths).
 */
function restoreFiles(repo, files) {
  const tracked = files.filter((f) => git(repo, ['cat-file', '-e', `HEAD:${f}`]).code === 0);
  for (let i = 0; i < tracked.length; i += ADD_BATCH) git(repo, ['checkout', 'HEAD', '--', ...tracked.slice(i, i + ADD_BATCH)]);
  for (const f of files.filter((x) => !tracked.includes(x))) removeFile(path.join(repo, f));
}

/** unlinkSync, not rmSync({ force }): on Windows rmSync silently left a non-ASCII path ("03c – new.csv") in place. */
function removeFile(p) {
  try { fs.unlinkSync(p); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}

/**
 * Drops the commit just made and explains why. A mixed reset keeps every working-tree change (nobody's
 * pending work is lost); `restore` files (the runner's own writes) go back to HEAD.
 */
function abortCommit(repo, expected, actual, restore) {
  git(repo, ['reset', '-q', '--mixed', 'HEAD^']);
  restoreFiles(repo, restore);
  const extra = actual.filter((f) => !expected.includes(f));
  const missing = expected.filter((f) => !actual.includes(f));
  throw new Error(`Commit did not match the publish list (extra: ${extra.join(', ') || 'none'}; missing: ${missing.join(', ') || 'none'}); commit dropped, nothing pushed`);
}

/** `git status --porcelain` lines → { file, state } (state: modified | untracked | deleted). */
function statusEntries(stdout) {
  return stdout.split(/\r?\n/).filter((l) => l.length > 3).map((l) => {
    const code = l.slice(0, 2);
    const file = normPath(l.slice(3).split(' -> ').pop());
    return { file, state: code === '??' ? 'untracked' : code.includes('D') ? 'deleted' : 'modified' };
  });
}

/**
 * Uncommitted changes that block a write. files = null: the whole repo (schema repo). files = [...]: a busy repo
 * (alan-shared-resources) — anything staged, plus changes to exactly those files; files = []: only anything staged
 * (an empty list must never widen to the whole repo).
 */
export function pendingChanges(repo, files = null) {
  const staged = pathLines(git(repo, ['diff', '--cached', '--name-only']).stdout).map((file) => ({ file, state: 'staged' }));
  if (files && !files.length) return staged;
  const status = statusEntries(git(repo, ['status', '--porcelain', ...(files ? ['--', ...files] : [])]).stdout);
  return [...staged, ...status.filter((s) => !staged.some((x) => x.file === s.file))];
}

export function assertClean(repo, files = null) {
  const problems = pendingChanges(repo, files).map((p) => `${p.state} ${p.file}`);
  if (problems.length) throw new Error(`The repo has uncommitted changes (${problems.slice(0, 5).join('; ')}); nothing was written`);
}

/**
 * Stage `files` (and deletions already made on disk) in batches, commit once, push once.
 * Returns { commit, nothing, files } — commit is the new SHA (null when there was nothing to commit).
 */
export function commitAndPush({ repo, files, message, branch = 'main', push = true, expectExact = false, restoreOnAbort = false }) {
  ensureGitOnBranch(repo, branch);
  removeStaleGitIndexLock(repo);
  const targets = [...new Set(files.map(normPath))];
  for (let i = 0; i < targets.length; i += ADD_BATCH) {
    gitStep(repo, ['add', '-A', '--', ...targets.slice(i, i + ADD_BATCH)], `Stage files (batch ${i / ADD_BATCH + 1})`);
  }
  const c = gitStep(repo, ['commit', '-m', message], 'Commit changes');
  if (c.nothing) return { commit: null, nothing: true, files: [] };
  const actual = pathLines(git(repo, ['diff', '--name-only', 'HEAD^', 'HEAD']).stdout);
  if (expectExact && !sameSet(actual, targets)) abortCommit(repo, targets, actual, restoreOnAbort ? targets : []);
  const commit = git(repo, ['rev-parse', 'HEAD']).stdout.trim();
  if (push) gitStep(repo, ['push'], 'Push to GitHub');
  return { commit, nothing: false, files: actual };
}

/** Files one commit changed, with status (A added, M modified, D deleted). */
export function commitFiles(repo, commit) {
  return lines(git(repo, ['diff-tree', '--no-commit-id', '--name-status', '-r', commit]).stdout)
    .map((l) => { const [status, ...rest] = l.split('\t'); return { status: status[0], file: normPath(rest.join('\t')) }; });
}

/**
 * Undo one published commit: restore exactly its files to their parent versions (added files are removed,
 * deleted files come back), as a new commit pushed the same way. Refused if a later commit touched those files.
 */
export function undoCommit({ repo, commit, message, branch = 'main', push = true, filesOnly = false }) {
  const changed = commitFiles(repo, commit);
  assertClean(repo, filesOnly ? changed.map((c) => c.file) : null);
  if (!changed.length) throw new Error(`Commit ${commit} changed no files`);
  const names = changed.map((c) => c.file);
  const later = lines(git(repo, ['log', '--format=%h', `${commit}..HEAD`, '--', ...names]).stdout);
  if (later.length) throw new Error(`Later commits (${later.join(', ')}) changed the same files; undo refused`);
  for (const c of changed) {
    if (c.status === 'A') removeFile(path.join(repo, c.file));
    else gitStep(repo, ['checkout', `${commit}^`, '--', c.file], `Restore ${c.file}`);
  }
  return commitAndPush({ repo, files: names, message: message || `Undo ${commit.slice(0, 8)}`, branch, push, expectExact: true, restoreOnAbort: true });
}
