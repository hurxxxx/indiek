import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';

const seoulDate = time => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit'}).format(time);

// Only what search engines treat as the page: title, description, structured data and main content.
// Shared chrome and asset versions stay out, so a stylesheet bump does not move every lastmod.
export function pageSignature(html) {
  const pick = pattern => html.match(pattern)?.[0] || '';
  return createHash('sha256').update([
    pick(/<title>[\s\S]*?<\/title>/),
    pick(/<meta name="description" content="[^"]*">/),
    pick(/<script type="application\/ld\+json">[\s\S]*?<\/script>/),
    pick(/<main[\s>][\s\S]*<\/main>/),
  ].join('\n')).digest('hex');
}

export function sitemapDates(xml = '') {
  const dates = new Map();
  for (const [, url, lastmod] of xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?<\/url>/g)) if (lastmod) dates.set(url, lastmod);
  return dates;
}

export function sitemapXML(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(({url, lastmod}) => `<url><loc>${url}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('')}</urlset>\n`;
}

// lastmod is the Korea-time date on which a page's signature last changed.
// The committed dist/ is the published record: HEAD's sitemap carries dates forward, and a page
// without one (the first run) takes the date of the oldest commit in its latest unchanged run.
// Create this before the build removes or rewrites any page.
export function lastmodTracker(root, {now = new Date()} = {}) {
  const today = seoulDate(now);
  const git = args => {
    try { return execFileSync('git', args, {cwd:root, encoding:'utf8', stdio:['ignore', 'pipe', 'ignore'], maxBuffer:64 * 1024 * 1024}); }
    catch { return null; }
  };
  const committed = git(['rev-parse', '--verify', 'HEAD']) !== null;
  const workingFile = file => existsSync(path.join(root, file)) ? readFileSync(path.join(root, file), 'utf8') : null;
  const previousSitemap = (committed ? git(['show', 'HEAD:dist/sitemap.xml']) : null) ?? workingFile('dist/sitemap.xml') ?? '';
  const previousDates = sitemapDates(previousSitemap);
  const pageFile = url => `dist${new URL(url).pathname}index.html`;
  // Without git, read the working tree now, before generated pages are replaced.
  const workingSignatures = committed ? null : new Map([...previousSitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => {
    const html = workingFile(pageFile(url));
    return [url, html === null ? null : pageSignature(html)];
  }));
  const previousSignature = url => {
    if (!committed) return workingSignatures.get(url) ?? null;
    const html = git(['show', `HEAD:${pageFile(url)}`]);
    return html === null ? null : pageSignature(html);
  };
  const historyDate = (url, signature) => {
    const log = git(['log', '--format=%H %ct', '--', pageFile(url)]);
    let date = null;
    for (const line of (log || '').trim().split('\n').filter(Boolean)) {
      const [hash, seconds] = line.split(' ');
      const html = git(['show', `${hash}:${pageFile(url)}`]);
      if (html === null || pageSignature(html) !== signature) break;
      date = seoulDate(new Date(Number(seconds) * 1000));
    }
    return date;
  };
  return (url, html) => {
    const signature = pageSignature(html);
    if (previousSignature(url) !== signature) return today;
    return previousDates.get(url) || (committed ? historyDate(url, signature) : null) || today;
  };
}
