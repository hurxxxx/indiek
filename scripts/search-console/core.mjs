import {createHash, sign} from 'node:crypto';

export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const SCOPE = 'https://www.googleapis.com/auth/webmasters';
const WEBMASTERS = 'https://www.googleapis.com/webmasters/v3';
const INSPECTION = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';
const base64url = value => Buffer.from(value).toString('base64url');
export const seoulDate = time => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit'}).format(time);
export const seoulTime = time => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul', dateStyle:'short', timeStyle:'short'}).format(time);

// Service-account JWT for the OAuth token exchange. The audience is fixed rather than read from the key file.
export function serviceAccountAssertion(key, now = new Date()) {
  if (!key?.client_email || !key?.private_key) throw new Error('Service account key needs client_email and private_key.');
  const issuedAt = Math.floor(now.getTime() / 1000);
  const unsigned = `${base64url(JSON.stringify({alg:'RS256', typ:'JWT'}))}.${base64url(JSON.stringify({iss:key.client_email, scope:SCOPE, aud:TOKEN_URL, iat:issuedAt, exp:issuedAt + 3600}))}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), key.private_key).toString('base64url')}`;
}

export function parseSitemap(xml) {
  const entries = [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?[\s\S]*?<\/url>/g)].map(([, url, lastmod]) => ({url:url.trim(), lastmod:lastmod?.trim() || null}));
  if (!entries.length) throw new Error('Sitemap has no URLs.');
  return {entries, hash:createHash('sha256').update(xml).digest('hex')};
}

async function googleJSON(url, {token, method = 'GET', body, fetcher = fetch}) {
  const response = await fetcher(url, {method, redirect:'error', headers:{Authorization:`Bearer ${token}`, ...(body ? {'Content-Type':'application/json'} : {})}, body:body ? JSON.stringify(body) : undefined, signal:AbortSignal.timeout(60000)});
  const text = await response.text();
  if (!response.ok) {
    let message = '';
    try { message = JSON.parse(text).error?.message || ''; } catch {}
    const error = new Error(`Google API ${response.status}${message ? `: ${message}` : ''}`);
    error.status = response.status;
    throw error;
  }
  return text ? JSON.parse(text) : {};
}

export async function accessToken(key, {fetcher = fetch, now = new Date()} = {}) {
  const response = await fetcher(TOKEN_URL, {method:'POST', redirect:'error', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion:serviceAccountAssertion(key, now)}), signal:AbortSignal.timeout(30000)});
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) throw new Error(`Google sign-in failed (${response.status}${result.error ? `: ${result.error}` : ''}).`);
  return result.access_token;
}

export function searchConsoleClient(token, property, {fetcher = fetch} = {}) {
  const site = `${WEBMASTERS}/sites/${encodeURIComponent(property)}`;
  return {
    site:() => googleJSON(site, {token, fetcher}),
    sitemap:feed => googleJSON(`${site}/sitemaps/${encodeURIComponent(feed)}`, {token, fetcher}),
    submitSitemap:feed => googleJSON(`${site}/sitemaps/${encodeURIComponent(feed)}`, {token, method:'PUT', fetcher}),
    inspect:url => googleJSON(INSPECTION, {token, method:'POST', body:{inspectionUrl:url, siteUrl:property, languageCode:'en-US'}, fetcher}),
  };
}

export function pageResult(entry, response) {
  const index = response?.inspectionResult?.indexStatusResult || {};
  return {url:entry.url, lastmod:entry.lastmod, verdict:index.verdict || null, coverageState:index.coverageState || null, indexingState:index.indexingState || null, pageFetchState:index.pageFetchState || null, robotsTxtState:index.robotsTxtState || null, lastCrawlTime:index.lastCrawlTime || null, googleCanonical:index.googleCanonical || null, userCanonical:index.userCanonical || null, crawledAs:index.crawledAs || null};
}

// What needs a person: pages Google has not indexed, pages not re-read since their sitemap date,
// and pages where Google chose another canonical URL.
export function pageIssues(page) {
  if (page.error) return [`검사 실패: ${page.error}`];
  const issues = [];
  if (page.verdict !== 'PASS') issues.push(`색인 안 됨: ${page.coverageState || page.verdict || '상태 없음'}`);
  if (page.verdict === 'PASS' && page.lastmod && (!page.lastCrawlTime || seoulDate(new Date(page.lastCrawlTime)) < page.lastmod)) issues.push(`수정일 ${page.lastmod} 이후 아직 다시 읽지 않음${page.lastCrawlTime ? ` (마지막 크롤링 ${seoulDate(new Date(page.lastCrawlTime))})` : ''}`);
  if (page.googleCanonical && page.googleCanonical !== page.url) issues.push(`Google이 고른 대표 URL이 다름: ${page.googleCanonical}`);
  return issues;
}

export function reportMarkdown(report) {
  if (report.status === 'not-connected') return `# Search Console 일일 점검\n\n확인: ${seoulTime(new Date(report.checkedAt))} KST\n\n연결 안 됨: 서비스 계정 키가 없습니다. deploy/README.md의 "Search Console 점검"을 따라 연결하세요. 수치는 추정하지 않습니다.\n`;
  const path = url => url.replace(/^https?:\/\/[^/]+/, '') || '/';
  const indexed = report.pages.filter(page => page.verdict === 'PASS').length;
  const flagged = report.pages.map(page => ({page, issues:pageIssues(page)})).filter(item => item.issues.length);
  const sitemap = report.sitemap;
  const status = sitemap.status || {};
  const lines = [
    '# Search Console 일일 점검', '',
    `확인: ${seoulTime(new Date(report.checkedAt))} KST · 속성 ${report.property} (${report.permissionLevel})`, '',
    `사이트맵: ${sitemap.urls}개 URL · ${sitemap.submitted ? '내용이 바뀌어 오늘 다시 제출함' : '변경 없음, 재제출 안 함'} · 마지막 제출 ${status.lastSubmitted ? seoulTime(new Date(status.lastSubmitted)) : '없음'} · Google이 읽은 시각 ${status.lastDownloaded ? seoulTime(new Date(status.lastDownloaded)) : '없음'} · 오류 ${status.errors ?? 0} · 경고 ${status.warnings ?? 0}${status.isPending ? ' · 처리 대기' : ''}`, '',
    `색인: ${indexed}/${report.pages.length}개 등록${report.inspectionStopped ? ` · 검사 중단: ${report.inspectionStopped}` : ''}`, '',
    '## 확인이 필요한 페이지', '',
    ...(flagged.length ? flagged.map(({page, issues}) => `- ${path(page.url)} — ${issues.join(' · ')}`) : ['없음']), '',
    '## 전체', '',
    '| 페이지 | 상태 | 마지막 크롤링 | 사이트맵 수정일 |', '|---|---|---|---|',
    ...report.pages.map(page => `| ${path(page.url)} | ${page.error ? '검사 실패' : page.coverageState || page.verdict || '-'} | ${page.lastCrawlTime ? seoulDate(new Date(page.lastCrawlTime)) : '-'} | ${page.lastmod || '-'} |`), '',
  ];
  return lines.join('\n');
}

export function reportSummary(report) {
  if (!report) return null;
  if (report.status === 'not-connected') return `Not connected (checked ${report.checkedAt}). No search figures inferred.`;
  const indexed = report.pages.filter(page => page.verdict === 'PASS').length;
  const flagged = report.pages.filter(page => pageIssues(page).length).length;
  return `${indexed}/${report.pages.length} sitemap pages indexed; ${flagged} need attention (checked ${report.checkedAt}). See search-console/latest.md.`;
}
