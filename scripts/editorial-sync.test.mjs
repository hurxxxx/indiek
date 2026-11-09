import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {manualRecords, syncServerCheckout} from './editorial/sync.mjs';

const env = {...process.env, GIT_AUTHOR_NAME:'test', GIT_AUTHOR_EMAIL:'test@example.com', GIT_COMMITTER_NAME:'test', GIT_COMMITTER_EMAIL:'test@example.com'};
const git = (cwd, ...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {cwd, env, encoding:'utf8', stdio:['ignore', 'pipe', 'pipe']});
const log = (manual, automatic, more = '') => `# Log\n\n${manual}\n\n<!-- automatic-promotion:start -->\n## Auto\n\n${automatic}\n<!-- automatic-promotion:end -->\n${more}`;

function repositories(t) {
  const base = mkdtempSync(path.join(tmpdir(), 'indiek-sync-'));
  t.after(() => rmSync(base, {recursive:true, force:true}));
  const origin = path.join(base, 'origin.git'), server = path.join(base, 'server'), local = path.join(base, 'local');
  git(base, 'init', '-q', '--bare', '-b', 'main', origin);
  git(base, 'clone', '-q', origin, local);
  mkdirSync(path.join(local, 'docs'));
  writeFileSync(path.join(local, 'docs/promotion.md'), log('G1', 'post A'));
  git(local, 'add', '.'); git(local, 'commit', '-qm', 'first'); git(local, 'push', '-q', 'origin', 'HEAD:main');
  git(base, 'clone', '-q', origin, server);
  return {local, server, file:path.join(server, 'docs/promotion.md')};
}

test('manual records ignore the generated section and blank lines at its edges', () => {
  assert.equal(manualRecords(log('G1', 'post A', '\n## G2\n')), manualRecords(log('G1', 'post B\npost C', '## G2\n')));
  assert.notEqual(manualRecords(log('G1', 'post A')), manualRecords(log('G1 edited', 'post A')));
});

test('a regenerated SNS section no longer blocks a fast-forward with new records', t => {
  const {local, server, file} = repositories(t);
  writeFileSync(file, log('G1', 'post A\npost B'));
  writeFileSync(path.join(local, 'docs/promotion.md'), log('G1', 'post A', '\n## G2\n'));
  git(local, 'commit', '-qam', 'record'); git(local, 'push', '-q', 'origin', 'HEAD:main');
  git(server, 'fetch', '-q', 'origin', 'main');
  assert.throws(() => git(server, 'merge', '--ff-only', 'origin/main'), /overwritten by merge/, 'the plain fast-forward fails');

  let regenerated = 0;
  const result = syncServerCheckout(server, 'origin', {git:(...args) => git(server, ...args), regenerate:() => { regenerated++; writeFileSync(file, log('G1', 'post A\npost B', '\n## G2\n')); }});
  assert.deepEqual(result, {restored:true});
  assert.equal(regenerated, 1);
  assert.equal(git(server, 'rev-parse', 'HEAD'), git(local, 'rev-parse', 'HEAD'));
  assert.match(readFileSync(file, 'utf8'), /post B[\s\S]*## G2/);
});

test('manual server edits or other local changes still stop the merge', t => {
  const {local, server, file} = repositories(t);
  writeFileSync(path.join(local, 'docs/promotion.md'), log('G1', 'post A', '\n## G2\n'));
  git(local, 'commit', '-qam', 'record'); git(local, 'push', '-q', 'origin', 'HEAD:main');
  const before = git(server, 'rev-parse', 'HEAD');
  writeFileSync(file, log('G1 edited on server', 'post A'));
  let regenerated = 0;
  const options = {git:(...args) => git(server, ...args), regenerate:() => { regenerated++; }};
  assert.throws(() => syncServerCheckout(server, 'origin', options), /outside the automatic section/);
  assert.match(readFileSync(file, 'utf8'), /edited on server/, 'manual edits are kept');
  assert.equal(git(server, 'rev-parse', 'HEAD'), before);
  assert.equal(regenerated, 0);
});
