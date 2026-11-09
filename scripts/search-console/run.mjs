import {existsSync, statSync, readFileSync, writeFileSync, renameSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {accessToken, searchConsoleClient, parseSitemap, pageResult, reportMarkdown, reportSummary} from './core.mjs';

// Kept independent of the promotion runner so this job never loads its publishing code.
function readJSON(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
function atomicWrite(file, value) {
  mkdirSync(path.dirname(file), {recursive:true, mode:0o700});
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, value, {mode:0o600});
  renameSync(temporary, file);
}

const root = fileURLToPath(new URL('../../', import.meta.url));
const site = JSON.parse(readFileSync(path.join(root, 'content/catalogue.json'), 'utf8')).site.url.replace(/\/$/, '');
const property = `${site}/`;
const sitemapURL = `${site}/sitemap.xml`;
const state = path.join(root, 'promotion/state/search-console');
const keyFile = process.env.INDIEK_SEARCH_CONSOLE_KEY || path.join(homedir(), '.config/indiek-search-console/service-account.json');
const command = process.argv[2] || 'status';
const now = new Date();
const writeAccess = new Set(['siteOwner', 'siteFullUser']);

function serviceAccount() {
  if (!existsSync(keyFile)) return null;
  if (statSync(keyFile).mode & 0o077) throw new Error('Service account key must have mode 600.');
  try { return readJSON(keyFile, null); } catch { throw new Error('Invalid service account key file. Values omitted.'); }
}
async function connect() {
  const key = serviceAccount();
  if (!key) return null;
  const client = searchConsoleClient(await accessToken(key), property);
  const {permissionLevel} = await client.site();
  if (!writeAccess.has(permissionLevel)) throw new Error(`Search Console access is ${permissionLevel || 'missing'}; add ${key.client_email} as a Full user of ${property}.`);
  return {client, permissionLevel, account:key.client_email};
}
async function liveSitemap() {
  const response = await fetch(sitemapURL, {redirect:'error', signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error(`Live sitemap returned ${response.status}.`);
  return parseSitemap(await response.text());
}
function save(report) {
  const day = now.toISOString().slice(0, 10);
  atomicWrite(path.join(state, 'reports', `${day}.json`), JSON.stringify(report, null, 2) + '\n');
  atomicWrite(path.join(state, 'latest.json'), JSON.stringify(report, null, 2) + '\n');
  atomicWrite(path.join(state, 'latest.md'), reportMarkdown(report));
}

async function daily() {
  const connection = await connect();
  if (!connection) {
    save({status:'not-connected', checkedAt:now.toISOString(), property});
    console.log(`Not connected: no service account key at ${keyFile}. Nothing was sent to Google.`);
    return;
  }
  const {client, permissionLevel} = connection;
  const previous = readJSON(path.join(state, 'latest.json'), {});
  const sitemap = await liveSitemap();
  // Resubmit only when the published sitemap differs from the last one sent; lastmod moves with real content changes.
  const submitted = previous.sitemap?.submittedHash !== sitemap.hash;
  if (submitted) await client.submitSitemap(sitemapURL);
  const status = await client.sitemap(sitemapURL).catch(error => ({error:error.message}));
  const pages = [];
  let inspectionStopped = null;
  for (const entry of sitemap.entries) {
    if (inspectionStopped) { pages.push({url:entry.url, lastmod:entry.lastmod, error:'not inspected'}); continue; }
    try { pages.push(pageResult(entry, await client.inspect(entry.url))); }
    catch (error) {
      pages.push({url:entry.url, lastmod:entry.lastmod, error:error.message});
      if (error.status === 429 || error.status === 403) inspectionStopped = error.message;
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  const report = {status:'checked', checkedAt:now.toISOString(), property, permissionLevel, sitemap:{url:sitemapURL, urls:sitemap.entries.length, hash:sitemap.hash, submitted, submittedHash:submitted ? sitemap.hash : previous.sitemap?.submittedHash ?? null, status:{lastSubmitted:status.lastSubmitted || null, lastDownloaded:status.lastDownloaded || null, isPending:Boolean(status.isPending), errors:Number(status.errors || 0), warnings:Number(status.warnings || 0), ...(status.error ? {error:status.error} : {})}}, inspectionStopped, pages};
  save(report);
  console.log(reportSummary(report));
  if (inspectionStopped || pages.some(page => page.error)) process.exitCode = 1;
}

async function check() {
  const connection = await connect();
  if (!connection) throw new Error(`No service account key at ${keyFile}.`);
  const status = await connection.client.sitemap(sitemapURL).catch(error => ({error:error.message}));
  console.log(JSON.stringify({property, account:connection.account, permissionLevel:connection.permissionLevel, sitemap:{lastSubmitted:status.lastSubmitted || null, lastDownloaded:status.lastDownloaded || null, errors:status.errors ?? null, warnings:status.warnings ?? null, ...(status.error ? {error:status.error} : {})}}, null, 2));
}

try {
  if (command === 'daily') await daily();
  else if (command === 'check') await check();
  else if (command === 'status') {
    const report = readJSON(path.join(state, 'latest.json'), null);
    console.log(JSON.stringify({keyPresent:existsSync(keyFile), property, latest:reportSummary(report) || 'No run yet.'}, null, 2));
  } else throw new Error('Commands: status, check (read-only API check), daily (resubmit changed sitemap and inspect every sitemap URL).');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
