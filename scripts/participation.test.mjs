import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, cpSync, mkdirSync, mkdtempSync, rmSync, existsSync} from 'node:fs';
import {execFileSync, spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createToken, validToken, readBallots, requestTextProblem, requestTextLength, normalizeRequestText, pollPhase, rankResults, kstLabel, localTimeLabel, callAPI, requestTextLimit} from '../site/participation.mjs';
import {validatePolls, pollPath} from './polls.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const authoredPolls = () => JSON.parse(readFileSync(path.join(root, 'content/polls.json'), 'utf8'));
const tracks = [{id:'a'}, {id:'b'}, {id:'c'}, {id:'d'}];

test('voting tokens are random base64url strings the API accepts', () => {
  const tokens = new Set(Array.from({length:50}, () => createToken()));
  assert.equal(tokens.size, 50);
  for (const token of tokens) {
    assert.ok(validToken(token), token);
    assert.equal(token.length, 24);
  }
  assert.ok(!validToken('short'));
  assert.ok(!validToken('AbCdEfGhIjKlMnOpQrStU='));
});

test('stored ballots keep only a valid code and the voted flag per poll', () => {
  const token = 'AbCdEfGhIjKlMnOpQrStUv';
  assert.deepEqual(readBallots(JSON.stringify({'listeners-picks-2026':{token, voted:true, choices:['a']}, 'Bad ID':{token}, other:{token:'x'}})), {'listeners-picks-2026':{token, voted:true}});
  assert.deepEqual(readBallots('not json'), {});
  assert.deepEqual(readBallots('[]'), {});
  assert.deepEqual(readBallots(null), {});
});

test('request notes follow the API rules (same cases as api/src/validate.rs)', () => {
  assert.equal(normalizeRequestText('  Jannabi   —\n“for lovers who hesitate” '), 'Jannabi — “for lovers who hesitate”');
  for (const ok of ['자우림 - 스물다섯, 스물하나', 'Song 1994 by 0310', '@artist_handle new single', '가'.repeat(requestTextLimit)]) assert.equal(requestTextProblem(ok), null, ok);
  assert.equal(requestTextProblem('   '), null);
  assert.equal(requestTextProblem('가'.repeat(requestTextLimit + 1)), 'text_too_long');
  assert.equal(requestTextProblem('see https://example.com'), 'text_has_link');
  assert.equal(requestTextProblem('www.example.com please'), 'text_has_link');
  assert.equal(requestTextProblem('mail me at fan@example.com'), 'text_has_contact');
  assert.equal(requestTextProblem('call +82 10-1234-5678'), 'text_has_contact');
  assert.equal(requestTextProblem('bad ‮text'), 'text_invalid_characters');
  // Characters, not UTF-16 units, as in Rust's chars().count().
  assert.equal(requestTextLength('🎸'.repeat(requestTextLimit)), requestTextLimit);
  assert.equal(requestTextProblem('🎸'.repeat(requestTextLimit)), null);
});

test('poll phase follows the page dates and an early close', () => {
  const poll = {opensAt:'2026-12-10T12:00:00+09:00', closesAt:'2027-01-01T00:00:00+09:00', status:'published'};
  assert.equal(pollPhase(poll, Date.parse('2026-12-10T02:59:59Z')), 'upcoming');
  assert.equal(pollPhase(poll, Date.parse('2026-12-10T03:00:00Z')), 'open');
  assert.equal(pollPhase(poll, Date.parse('2026-12-31T15:00:00Z')), 'closed');
  assert.equal(pollPhase({...poll, status:'closed'}, Date.parse('2026-12-20T00:00:00Z')), 'closed');
});

test('results share ranks on ties, ignore unknown songs and report the share of ballots', () => {
  const order = new Map([['a', 0], ['b', 1], ['c', 2], ['d', 3]]);
  const rows = rankResults([{id:'c', votes:4}, {id:'x', votes:9}, {id:'b', votes:4}, {id:'a', votes:6}, {id:'d', votes:0}], 10, order);
  assert.deepEqual(rows.map(row => [row.id, row.rank, row.share]), [['a', 1, 0.6], ['b', 2, 0.4], ['c', 2, 0.4]]);
  assert.deepEqual(rankResults(null, 0, order), []);
});

test('times are shown in Korea time, with the reader’s own clock when it differs', () => {
  assert.equal(kstLabel('2026-12-10T12:00:00+09:00'), '10 December 2026, 12:00 KST');
  assert.equal(kstLabel('2027-01-01T00:00:00+09:00'), '1 January 2027, 00:00 KST');
  assert.equal(localTimeLabel('2026-12-10T12:00:00+09:00', 'Asia/Seoul'), '');
  assert.match(localTimeLabel('2026-12-10T12:00:00+09:00', 'Europe/London'), /^10 December, 03:00 (GMT|UTC)/);
});

test('API calls time out, read error codes and never throw', async () => {
  const json = (status, body) => async () => new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json'}});
  assert.deepEqual(await callAPI('/api/x', {fetchImpl:json(201, {status:'recorded'})}), {ok:true, status:201, data:{status:'recorded'}, error:null});
  assert.equal((await callAPI('/api/x', {fetchImpl:json(409, {error:'already_voted'})})).error, 'already_voted');
  assert.equal((await callAPI('/api/x', {fetchImpl:async () => new Response('<html>', {status:502})})).error, 'unavailable');
  assert.equal((await callAPI('/api/x', {fetchImpl:async () => { throw new TypeError('offline'); }})).error, 'unavailable');
  const slow = (url, {signal}) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
  const timed = await callAPI('/api/x', {fetchImpl:slow, timeout:20});
  assert.equal(timed.status, 0);
  assert.equal(timed.error, 'unavailable');
  const page = new AbortController();
  const leaving = callAPI('/api/x', {fetchImpl:slow, signal:page.signal});
  page.abort();
  assert.equal((await leaving).error, 'aborted');
  let sent;
  await callAPI('/api/requests', {method:'POST', body:{type:'song', text:'x'}, fetchImpl:async (url, options) => { sent = options; return new Response(null, {status:202}); }});
  assert.equal(sent.credentials, 'omit');
  assert.equal(sent.headers['Content-Type'], 'application/json');
  assert.equal(sent.body, '{"type":"song","text":"x"}');
});

test('poll definitions keep the approved settings and are checked before a page is built', () => {
  const [poll] = authoredPolls().polls;
  assert.deepEqual({status:poll.status, opensAt:poll.opensAt, closesAt:poll.closesAt, maxChoices:poll.maxChoices, resultsVisibility:poll.resultsVisibility}, {status:'draft', opensAt:'2026-12-10T12:00:00+09:00', closesAt:'2027-01-01T00:00:00+09:00', maxChoices:3, resultsVisibility:'after-close'});
  const base = {...poll, status:'published'};
  assert.deepEqual(validatePolls({schemaVersion:1, polls:[base]}, tracks)[0].choiceIds, ['a', 'b', 'c', 'd']);
  assert.equal(pollPath(base), '/polls/listeners-picks-2026/');
  const bad = [
    {...base, choiceKind:'artist'}, {...base, choiceIds:['a', 'zz']}, {...base, choiceIds:['a', 'a']},
    {...base, maxChoices:5}, {...base, maxChoices:0}, {...base, closesAt:base.opensAt}, {...base, opensAt:'2026-12-10 12:00'},
    {...base, status:'open'}, {...base, intro:''}, {...base, id:'Bad'},
  ];
  for (const entry of bad) assert.throws(() => validatePolls({schemaVersion:1, polls:[entry]}, tracks), /Poll/, JSON.stringify(entry));
  assert.throws(() => validatePolls({schemaVersion:1, polls:[base, base]}, tracks), /duplicate/);
  assert.throws(() => validatePolls({schemaVersion:2, polls:[]}, tracks), /schemaVersion/);
});

test('a published poll gets a page, sitemap entry and passing checks; a draft stays out of public builds', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'indiek-poll-build-'));
  try {
    for (const folder of ['scripts', 'site', 'content', '.openai']) cpSync(path.join(root, folder), path.join(dir, folder), {recursive:true});
    mkdirSync(path.join(dir, 'dist'));
    for (const item of ['assets', 'favicon.svg', 'sitemap.xml']) cpSync(path.join(root, 'dist', item), path.join(dir, 'dist', item), {recursive:true});
    const file = authoredPolls();
    // Preview output of a draft must not survive a publication build.
    execFileSync(process.execPath, ['scripts/build.mjs', '--preview'], {cwd:dir, stdio:'pipe'});
    const preview = readFileSync(path.join(dir, 'dist/polls/listeners-picks-2026/index.html'), 'utf8');
    assert.match(preview, /<meta name="robots" content="noindex">/);
    assert.match(preview, /LOCAL PREVIEW \/ DRAFT POLL/);
    const draftCheck = spawnSync('python3', ['scripts/check.py'], {cwd:dir, encoding:'utf8'});
    assert.notEqual(draftCheck.status, 0);
    assert.match(draftCheck.stdout + draftCheck.stderr, /draft preview; run npm run build/);
    execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:dir, stdio:'pipe'});
    assert.ok(!existsSync(path.join(dir, 'dist/polls')));
    assert.ok(!existsSync(path.join(dir, 'dist/assets/social/polls-listeners-picks-2026.jpg')));
    file.polls[0].status = 'published';
    writeFileSync(path.join(dir, 'content/polls.json'), JSON.stringify(file));
    execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:dir, stdio:'pipe'});
    execFileSync('python3', ['scripts/check.py'], {cwd:dir, stdio:'pipe'});
    const page = readFileSync(path.join(dir, 'dist/polls/listeners-picks-2026/index.html'), 'utf8');
    assert.ok(!page.includes('noindex'));
    assert.ok(!page.includes('<iframe'));
    assert.equal((page.match(/data-poll-input disabled hidden/g) || []).length, (page.match(/data-poll-choice=/g) || []).length);
    assert.match(page, /10 December 2026, 12:00 KST/);
    assert.match(page, /Up to three songs/);
    assert.ok(readFileSync(path.join(dir, 'dist/sitemap.xml'), 'utf8').includes('https://indiek.com/polls/listeners-picks-2026/'));
    assert.match(readFileSync(path.join(dir, 'dist/catalogue.js'), 'utf8'), /"polls":\[\{"id":"listeners-picks-2026","path":"\/polls\/listeners-picks-2026\/"\}\]/);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});
