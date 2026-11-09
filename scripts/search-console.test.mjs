import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, verify} from 'node:crypto';
import {accessToken, pageIssues, pageResult, parseSitemap, reportMarkdown, reportSummary, searchConsoleClient, serviceAccountAssertion, SCOPE, TOKEN_URL} from './search-console/core.mjs';

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
