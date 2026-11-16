import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, verify} from 'node:crypto';
import {accessToken, pageIssues, pageResult, parseSitemap, reportMarkdown, reportSummary, searchConsoleClient, serviceAccountAssertion, SCOPE, TOKEN_URL, INDEXNOW_ENDPOINT, validIndexNowKey, indexNowChanges, indexNowRun, indexNowLine} from './search-console/core.mjs';

const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength:2048});
const key = {client_email:'indiek@example.iam.gserviceaccount.com', private_key:privateKey.export({type:'pkcs8', format:'pem'}), token_uri:'https://attacker.example/token'};
const decode = part => JSON.parse(Buffer.from(part, 'base64url').toString());

test('service account assertion is signed for the fixed Google token endpoint', () => {
  const now = new Date('2026-11-10T00:00:00Z');
  const [header, claims, signature] = serviceAccountAssertion(key, now).split('.');
  assert.deepEqual(decode(header), {alg:'RS256', typ:'JWT'});
  assert.deepEqual(decode(claims), {iss:key.client_email, scope:SCOPE, aud:TOKEN_URL, iat:1794268800, exp:1794272400});
  assert.ok(verify('RSA-SHA256', Buffer.from(`${header}.${claims}`), publicKey, Buffer.from(signature, 'base64url')));
  assert.throws(() => serviceAccountAssertion({client_email:'x'}), /private_key/);
});

test('token exchange posts the assertion and never echoes the key', async () => {
  const calls = [];
  const token = await accessToken(key, {fetcher:async (url, options) => { calls.push({url, body:String(options.body)}); return new Response(JSON.stringify({access_token:'token-1'}), {status:200}); }});
  assert.equal(token, 'token-1');
  assert.equal(calls[0].url, TOKEN_URL);
  assert.match(calls[0].body, /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=/);
  await assert.rejects(accessToken(key, {fetcher:async () => new Response(JSON.stringify({error:'invalid_grant'}), {status:400})}), error => /invalid_grant/.test(error.message) && !error.message.includes('PRIVATE KEY'));
});

test('client encodes the property and sitemap and reports API errors with status', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({url, method:options.method, body:options.body, auth:options.headers.Authorization});
    if (url.includes('index:inspect')) return new Response(JSON.stringify({error:{message:'Quota exceeded'}}), {status:429});
    return new Response(options.method === 'PUT' ? '' : JSON.stringify({permissionLevel:'siteFullUser'}), {status:200});
  };
  const client = searchConsoleClient('token-1', 'https://indiek.com/', {fetcher});
  assert.deepEqual(await client.site(), {permissionLevel:'siteFullUser'});
  assert.deepEqual(await client.submitSitemap('https://indiek.com/sitemap.xml'), {});
  await assert.rejects(client.inspect('https://indiek.com/artists/mrch/'), error => error.status === 429 && /Quota exceeded/.test(error.message));
  assert.equal(calls[0].url, 'https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Findiek.com%2F');
  assert.deepEqual([calls[1].method, calls[1].url], ['PUT', 'https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Findiek.com%2F/sitemaps/https%3A%2F%2Findiek.com%2Fsitemap.xml']);
  assert.deepEqual(JSON.parse(calls[2].body), {inspectionUrl:'https://indiek.com/artists/mrch/', siteUrl:'https://indiek.com/', languageCode:'en-US'});
  assert.ok(calls.every(call => call.auth === 'Bearer token-1'));
});

test('sitemap parsing keeps lastmod and rejects empty sitemaps', () => {
  const {entries, hash} = parseSitemap('<urlset><url><loc>https://indiek.com/</loc><lastmod>2026-11-09</lastmod></url><url><loc>https://indiek.com/about/</loc></url></urlset>');
  assert.deepEqual(entries, [{url:'https://indiek.com/', lastmod:'2026-11-09'}, {url:'https://indiek.com/about/', lastmod:null}]);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.throws(() => parseSitemap('<urlset></urlset>'), /no URLs/);
});

test('issues flag unindexed, stale and re-canonicalised pages only', () => {
  const entry = {url:'https://indiek.com/artists/moneto/', lastmod:'2026-11-09'};
  const inspected = index => pageResult(entry, {inspectionResult:{indexStatusResult:index}});
  assert.deepEqual(pageIssues(inspected({verdict:'PASS', coverageState:'Submitted and indexed', lastCrawlTime:'2026-11-09T05:00:00Z', googleCanonical:entry.url})), []);
  assert.deepEqual(pageIssues(inspected({verdict:'NEUTRAL', coverageState:'Discovered - currently not indexed'})), ['색인 안 됨: Discovered - currently not indexed']);
  assert.deepEqual(pageIssues(inspected({verdict:'PASS', lastCrawlTime:'2026-11-02T05:00:00Z', googleCanonical:entry.url})), ['수정일 2026-11-09 이후 아직 다시 읽지 않음 (마지막 크롤링 2026-11-02)']);
  assert.deepEqual(pageIssues(inspected({verdict:'PASS', lastCrawlTime:'2026-11-09T05:00:00Z', googleCanonical:'https://indiek.com/artists/'})), ['Google이 고른 대표 URL이 다름: https://indiek.com/artists/']);
  assert.deepEqual(pageIssues({...entry, error:'not inspected'}), ['검사 실패: not inspected']);
});

test('reports say when nothing is connected and summarise checked runs', () => {
  const missing = {status:'not-connected', checkedAt:'2026-11-09T19:20:00Z', property:'https://indiek.com/'};
  assert.match(reportMarkdown(missing), /연결 안 됨/);
  assert.match(reportSummary(missing), /Not connected/);
  const report = {status:'checked', checkedAt:'2026-11-09T19:20:00Z', property:'https://indiek.com/', permissionLevel:'siteFullUser', sitemap:{urls:2, submitted:true, status:{lastSubmitted:'2026-11-09T19:19:00Z', errors:0, warnings:0}}, inspectionStopped:null, pages:[
    {url:'https://indiek.com/', lastmod:'2026-11-09', verdict:'PASS', coverageState:'Submitted and indexed', lastCrawlTime:'2026-11-09T10:00:00Z', googleCanonical:'https://indiek.com/'},
    {url:'https://indiek.com/artists/mrch/', lastmod:'2026-11-09', verdict:'NEUTRAL', coverageState:'URL is unknown to Google'},
  ]};
  const markdown = reportMarkdown(report);
  assert.match(markdown, /확인: 2026-11-10 04:20 KST/);
  assert.match(markdown, /색인: 1\/2개 등록/);
  assert.match(markdown, /- \/artists\/mrch\/ — 색인 안 됨: URL is unknown to Google/);
  assert.match(markdown, /내용이 바뀌어 오늘 다시 제출함/);
  assert.equal(reportSummary(report), '1/2 sitemap pages indexed; 1 need attention (checked 2026-11-09T19:20:00Z). See search-console/latest.md.');
});

const nowKey = '0123456789abcdef0123456789abcdef';
const site = 'https://indiek.com';
const entries = [{url:'https://indiek.com/', lastmod:'2026-11-15'}, {url:'https://indiek.com/artists/mrch/', lastmod:'2026-11-12'}, {url:'https://indiek.com/stories/new/', lastmod:'2026-11-16'}];
const sentBefore = {'https://indiek.com/':'2026-11-15', 'https://indiek.com/artists/mrch/':'2026-11-09', 'https://indiek.com/notes/gone/':'2026-11-01'};
const indexNowFetcher = ({keyFile = nowKey, post = 200} = {}) => {
  const calls = [];
  const fetcher = async (url, options = {}) => {
    calls.push({url, method:options.method || 'GET', headers:options.headers, body:options.body});
    if (url === `${site}/${nowKey}.txt`) return keyFile instanceof Error ? Promise.reject(keyFile) : new Response(keyFile, {status:typeof keyFile === 'number' ? keyFile : 200});
    if (post instanceof Error) throw post;
    return new Response('', {status:post});
  };
  return {calls, fetcher};
};

test('IndexNow keys follow the protocol and changes are compared with the last accepted sitemap', () => {
  assert.ok(validIndexNowKey(nowKey));
  for (const key of ['short', 'with space 12345', 'under_score_123', 'x'.repeat(129), undefined]) assert.equal(validIndexNowKey(key), false);
  assert.deepEqual(indexNowChanges(entries, null), {baseline:true, current:{'https://indiek.com/':'2026-11-15', 'https://indiek.com/artists/mrch/':'2026-11-12', 'https://indiek.com/stories/new/':'2026-11-16'}, urls:[]});
  // re-dated, new and removed pages are sent; an unchanged page is not.
  assert.deepEqual(indexNowChanges(entries, sentBefore).urls, ['https://indiek.com/artists/mrch/', 'https://indiek.com/stories/new/', 'https://indiek.com/notes/gone/']);
  assert.deepEqual(indexNowChanges(entries, indexNowChanges(entries, null).current).urls, []);
});

test('the first IndexNow run only records a baseline and unchanged runs send nothing', async () => {
  const {calls, fetcher} = indexNowFetcher();
  const now = new Date('2026-11-16T19:20:00Z');
  assert.deepEqual(await indexNowRun({entries, previous:undefined, site, key:null, fetcher, now}), {status:'not-configured'});
  const baseline = await indexNowRun({entries, previous:undefined, site, key:nowKey, fetcher, now});
  assert.equal(baseline.status, 'baseline');
  assert.equal(baseline.urls, 3);
  assert.equal(baseline.baselineAt, '2026-11-16T19:20:00.000Z');
  const quiet = await indexNowRun({entries, previous:baseline, site, key:nowKey, fetcher, now});
  assert.equal(quiet.status, 'no-changes');
  assert.deepEqual(quiet.sent, baseline.sent);
  assert.equal(quiet.baselineAt, baseline.baselineAt);
  assert.equal(calls.length, 0, 'nothing is fetched or submitted without changes');
  await assert.rejects(indexNowRun({entries, previous:undefined, site, key:'bad key', fetcher, now}), /indexNowKey/);
});

test('changed pages are posted once to the shared endpoint after the live key file is confirmed', async () => {
  for (const post of [200, 202]) {
    const {calls, fetcher} = indexNowFetcher({post});
    const previous = {status:'no-changes', baselineAt:'2026-11-16T19:20:00.000Z', sent:sentBefore, lastSubmission:null};
    const result = await indexNowRun({entries, previous, site, key:nowKey, fetcher, now:new Date('2026-11-17T19:20:00Z')});
    assert.deepEqual(calls.map(call => [call.method, call.url]), [['GET', `${site}/${nowKey}.txt`], ['POST', INDEXNOW_ENDPOINT]]);
    assert.equal(calls[1].headers['Content-Type'], 'application/json; charset=utf-8');
    assert.deepEqual(JSON.parse(calls[1].body), {host:'indiek.com', key:nowKey, keyLocation:`${site}/${nowKey}.txt`, urlList:['https://indiek.com/artists/mrch/', 'https://indiek.com/stories/new/', 'https://indiek.com/notes/gone/']});
    assert.equal(result.status, 'submitted');
    assert.deepEqual(result.sent, indexNowChanges(entries, null).current);
    assert.deepEqual(result.lastSubmission, {at:'2026-11-17T19:20:00.000Z', httpStatus:post, urls:JSON.parse(calls[1].body).urlList});
    assert.equal(result.baselineAt, previous.baselineAt);
    assert.equal(indexNowLine(result), `IndexNow: 오늘 3개 제출(HTTP ${post})`);
  }
});

test('a refused, failed or unverifiable IndexNow submission keeps the old map so the pages are retried', async () => {
  const lastSubmission = {at:'2026-11-17T19:20:00.000Z', httpStatus:200, urls:['https://indiek.com/']};
  const previous = {status:'submitted', baselineAt:'2026-11-16T19:20:00.000Z', sent:sentBefore, lastSubmission};
  const cases = [
    [{post:403}, result => result.httpStatus === 403, 2],
    [{post:429}, result => result.httpStatus === 429, 2],
    [{post:new Error('socket hang up')}, result => result.error === 'socket hang up', 2],
    [{keyFile:'another-key-000'}, result => /does not serve the key/.test(result.error), 1],
    [{keyFile:404}, result => /HTTP 404/.test(result.error), 1],
    [{keyFile:new Error('getaddrinfo ENOTFOUND')}, result => /ENOTFOUND/.test(result.error), 1],
  ];
  for (const [options, matches, requests] of cases) {
    const {calls, fetcher} = indexNowFetcher(options);
    const result = await indexNowRun({entries, previous, site, key:nowKey, fetcher, now:new Date('2026-11-18T19:20:00Z')});
    assert.equal(result.status, 'failed');
    assert.ok(matches(result), JSON.stringify(result));
    assert.equal(calls.length, requests, 'no submission is posted when the key file is not served');
    assert.deepEqual(result.sent, sentBefore);
    assert.deepEqual(result.pending, ['https://indiek.com/artists/mrch/', 'https://indiek.com/stories/new/', 'https://indiek.com/notes/gone/']);
    assert.deepEqual(result.lastSubmission, lastSubmission);
    assert.match(indexNowLine(result), /^IndexNow: 제출 실패\(.+\) · 3개는 다음 실행에서 다시 제출 · 마지막 제출 2026-11-18 04:20 1개\(HTTP 200\)$/);
  }
});

test('daily reports carry the IndexNow line whether or not Google is connected', () => {
  const indexNow = {status:'baseline', checkedAt:'2026-11-16T19:20:00.000Z', baselineAt:'2026-11-16T19:20:00.000Z', urls:86, sent:{}, lastSubmission:null};
  assert.match(reportMarkdown({status:'not-connected', checkedAt:'2026-11-16T19:20:00Z', property:'https://indiek.com/', indexNow}), /IndexNow: 기준 기록 86개 URL/);
  const checked = reportMarkdown({status:'checked', checkedAt:'2026-11-16T19:20:00Z', property:'https://indiek.com/', permissionLevel:'siteFullUser', sitemap:{urls:0, submitted:false, status:{}}, inspectionStopped:null, pages:[], indexNow});
  assert.match(checked, /색인: 0\/0개 등록\n\nIndexNow: 기준 기록 86개 URL\. 이후 추가·수정·삭제된 페이지만 제출한다\n\n## 확인이 필요한 페이지/);
  assert.doesNotMatch(reportMarkdown({status:'checked', checkedAt:'2026-11-16T19:20:00Z', property:'https://indiek.com/', permissionLevel:'siteFullUser', sitemap:{urls:0, submitted:false, status:{}}, inspectionStopped:null, pages:[]}), /IndexNow/);
});
