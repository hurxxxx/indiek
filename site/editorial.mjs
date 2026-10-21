import {artistId, artistPath, guidePath, getArtistRecords} from './shared.mjs';

export const shareImagePath = url => `/assets/social/${url === '/' ? 'home' : url.replace(/^\/+|\/+$/g, '').replaceAll('/', '-')}.jpg`;
export function editorialEntries(catalogue, guides) {
  return [
    ...getArtistRecords(catalogue).map(r => ({id:artistId(r), path:artistPath(r), title:`${r.artist} — ${r.track}`, description:r.artistIntro, type:'Artist', ...r.editorial})),
    ...guides.map(g => ({id:g.id, path:guidePath(g), title:g.title, description:g.description, type:'Guide', ...g.editorial})),
  ];
}
export function publishedEntries(entries, now = new Date()) {
  return entries.filter(entry => entry.published && /^\d{4}-\d{2}-\d{2}$/.test(entry.published) && Date.parse(entry.published) <= now.getTime())
    .sort((a,b) => b.published.localeCompare(a.published) || a.path.localeCompare(b.path));
}
const updateLabels = {artist:'New artist',song:'New song',lyrics:'Lyric notes',live:'Live session',story:'New story',guide:'New guide',update:'Updated'};
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
export function homeUpdates(entries, updates, {now = new Date(), preview = false, limit = 4, excludePaths = []} = {}) {
  const pagePath = value => value.split('#')[0];
  const targets = new Map(entries.map(entry => [entry.path,entry]));
  const seenIds = new Set();
  const additions = [];
  for (const update of updates) {
    if (!update.id || seenIds.has(update.id)) throw new Error(`Missing or duplicate home update ID: ${update.id}`);
    seenIds.add(update.id);
    if (!['draft','ready','published'].includes(update.status)) throw new Error(`Invalid home update status: ${update.id}`);
    if (update.status === 'draft') continue;
    const target = typeof update.path === 'string' && targets.get(pagePath(update.path));
    if (!target || !updateLabels[update.kind] || !update.title?.trim() || !update.description?.trim()) throw new Error(`Incomplete home update or unknown page: ${update.id}`);
    if (update.status === 'ready') {
      if (update.published) throw new Error(`Ready home update must not claim a publication date: ${update.id}`);
      if (!preview) continue;
    } else {
      const newPage = ['artist','story','guide'].includes(update.kind);
      if (!validDate(update.published) || (newPage && !validDate(target.published)) || (target.published && (!validDate(target.published) || update.published < target.published))) throw new Error(`Home update needs the actual page and update publication dates: ${update.id}`);
      if (Date.parse(update.published + 'T00:00:00+09:00') > now.getTime()) continue;
    }
    additions.push({...update,label:updateLabels[update.kind],date:update.published || '',preview:update.status === 'ready',explicit:true});
  }
  const candidates = [
    ...additions,
    ...publishedEntries(entries,now).map(entry => ({...entry,label:updateLabels[entry.type.toLowerCase()] || entry.type,date:entry.published})),
  ].sort((a,b) => Number(Boolean(b.preview)) - Number(Boolean(a.preview)) || b.date.localeCompare(a.date) || Number(Boolean(b.explicit)) - Number(Boolean(a.explicit)));
  const seenPaths = new Set(excludePaths);
  return candidates.filter(item => {
    const path = pagePath(item.path);
    if (seenPaths.has(path)) return false;
    seenPaths.add(path);
    return true;
  }).slice(0,limit);
}
export function relatedRecords(record, guides) {
  const relevant = guides.filter(g => g.records.some(r => artistId(r) === artistId(record)))
    .sort((a,b) => Number(b.selection === 'curated') - Number(a.selection === 'curated'));
  const others = relevant.flatMap(g => g.records).filter(r => artistId(r) !== artistId(record));
  return {guides: relevant.slice(0,3), records:others.filter((r,i) => others.findIndex(other => artistId(other) === artistId(r)) === i).slice(0,3)};
}
