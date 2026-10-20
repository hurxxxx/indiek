import {escapeHTML as e, artistPath, guidePath} from './shared.mjs';

export const shareImagePath = url => `/assets/social/${url === '/' ? 'home' : url.replace(/^\/+|\/+$/g, '').replaceAll('/', '-')}.jpg`;
export function editorialEntries(catalogue, guides) {
  return [
    ...[...catalogue.records, catalogue.editorPick].map(r => ({id:r.id, path:artistPath(r), title:`${r.artist} — ${r.track}`, description:r.artistIntro, type:'Artist', ...r.editorial})),
    ...guides.map(g => ({id:g.id, path:guidePath(g), title:g.title, description:g.description, type:'Guide', ...g.editorial})),
  ];
}
export function publishedEntries(entries, now = new Date()) {
  return entries.filter(entry => entry.published && /^\d{4}-\d{2}-\d{2}$/.test(entry.published) && Date.parse(entry.published) <= now.getTime())
    .sort((a,b) => b.published.localeCompare(a.published) || a.path.localeCompare(b.path));
}
export function feedXML(site, entries, now = new Date()) {
  const items = publishedEntries(entries, now);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>indiek — Music from Korea, worth sharing</title><link>${e(site.url)}</link><description>Stories, artist introductions and listening guides from indiek.</description><language>en</language><atom:link href="${site.url}/feed.xml" rel="self" type="application/rss+xml"/>${items.map(item => `<item><title>${e(item.title)}</title><link>${e(site.url + item.path)}</link><guid isPermaLink="true">${e(site.url + item.path)}</guid><pubDate>${new Date(item.published + 'T00:00:00+09:00').toUTCString()}</pubDate><description>${e(item.description)}</description></item>`).join('')}</channel></rss>\n`;
}
export function relatedRecords(record, guides) {
  const relevant = guides.filter(g => g.records.some(r => r.id === record.id))
    .sort((a,b) => Number(b.selection === 'curated') - Number(a.selection === 'curated'));
  return {guides: relevant.slice(0,3), records:[...new Map(relevant.flatMap(g => g.records).filter(r => r.id !== record.id).map(r => [r.id,r])).values()].slice(0,3)};
}
