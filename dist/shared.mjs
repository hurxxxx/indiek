export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const artistPath = record => `/artists/${record.id}/`;
export const guidePath = guide => `/notes/${guide.id}/`;
export const formatPosition = number => String(number).padStart(2, '0');
export const navigationSection = pathname => pathname.startsWith('/stories/') ? 'stories' : pathname.startsWith('/artists/') ? 'artists' : pathname.startsWith('/notes/') ? 'guides' : pathname === '/' ? 'home' : null;

export function getListeningGuides({records, editorPick, listeningGuides}) {
  const all = [...records, editorPick];
  const recordIds = all.map(record => record.id);
  if (new Set(recordIds).size !== all.length) throw new Error('Duplicate catalogue artist ID');
  if (!listeningGuides?.length) throw new Error('No listening guides configured');
  const guideIds = listeningGuides.map(guide => guide.id);
  if (new Set(guideIds).size !== guideIds.length) throw new Error('Duplicate listening guide ID');
  const tags = new Set(listeningGuides.filter(guide => guide.selection === 'tag').map(guide => guide.id));
  for (const record of all) {
    if (record.guideTags !== undefined && !Array.isArray(record.guideTags)) throw new Error(`Invalid guideTags for ${record.id}`);
    for (const tag of record.guideTags || []) {
      if (!tags.has(tag)) throw new Error(`Unknown guide tag "${tag}" for ${record.id}`);
    }
  }
  const covered = new Set();
  const guides = listeningGuides.map(guide => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guide.id) || guide.id === 'first-listens') throw new Error(`Invalid guide ID: ${guide.id}`);
    if (!['live', 'tag', 'curated'].includes(guide.selection)) throw new Error(`Invalid selection for ${guide.id}`);
    if (guide.selection === 'curated') {
      if (!Array.isArray(guide.trackIds) || guide.trackIds.length < 3 || guide.trackIds.length > 5 || new Set(guide.trackIds).size !== guide.trackIds.length) throw new Error(`Curated guide ${guide.id} needs 3–5 distinct tracks`);
      const ordered = guide.trackIds.map(id => {
        const record = all.find(record => record.id === id);
        if (!record || !guide.trackNotes?.[id]?.trim()) throw new Error(`Missing curated track or note: ${guide.id}/${id}`);
        const detail = guide.trackDetails?.[id];
        if (guide.includeCatalogue && (!detail?.listenFor?.trim() || !detail.nextNote?.trim() || detail.nextArtistId === id || !recordIds.includes(detail.nextArtistId))) throw new Error(`Missing listening detail or next artist: ${guide.id}/${id}`);
        return record;
      });
      // Curated essays do not replace automatic coverage of newly added artists.
      return {...guide, records: ordered, moreRecords: guide.includeCatalogue ? all.filter(record => !guide.trackIds.includes(record.id)) : []};
    }
    const matches = all.filter(record => guide.selection === 'live' ? record.videoType === 'live' : record.guideTags?.includes(guide.id));
    const first = matches.find(record => record.id === guide.featuredArtistId);
    if (!first) throw new Error(`Featured artist ${guide.featuredArtistId} is not included in ${guide.id}`);
    const ordered = [first, ...matches.filter(record => record !== first)];
    ordered.forEach(record => covered.add(record.id));
    return {...guide, records: ordered};
  });
  const missing = all.filter(record => !covered.has(record.id));
  if (missing.length) throw new Error(`Artists missing from listening guides: ${missing.map(record => record.id).join(', ')}`);
  return guides.filter(guide => guide.status !== 'draft').sort((a,b) => Number(b.selection === 'curated') - Number(a.selection === 'curated'));
}

// Editorial overrides set the opening order; every catalogue artist still appears.
export function getFeaturedArtists({records, editorPick, featuredArtists = []}) {
  const all = [...records, editorPick];
  const ids = [...new Set([...featuredArtists.map(feature => feature.id), ...all.map(record => record.id)])];
  return ids.map(id => {
    const record = all.find(record => record.id === id);
    if (!record) throw new Error(`Unknown featured artist: ${id}`);
    const feature = featuredArtists.find(feature => feature.id === id) || {};
    return {
      id, image: record.image, alt: `${record.release || record.album} — release artwork`,
      position: '50% 50%', kind: feature.image ? 'portrait' : 'artwork',
      title: record.note, deck: `Meet ${escapeHTML(record.artist)} through <em>${escapeHTML(record.track)}</em>.`,
      ...feature,
    };
  });
}
export const normalizeSearch = value => String(value).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

export function searchCatalogue(records, pick, query) {
  const compact = normalizeSearch(query);
  const words = query.trim().split(/\s+/).map(normalizeSearch).filter(Boolean);
  return [...records, pick].filter(record => {
    const text = normalizeSearch([record.artist, record.korean, record.aliases, record.track, record.koreanTitle, record.release, record.genre, record.category].filter(Boolean).join(' '));
    return text.includes(compact) || words.every(word => text.includes(word));
  });
}

export function getArtistDirectory(catalogue, {query = '', category = 'all'} = {}) {
  return searchCatalogue(catalogue.records, catalogue.editorPick, query)
    .filter(record => category === 'all' || record.category === category)
    .sort((a, b) => a.artist.localeCompare(b.artist, 'en', {sensitivity:'base', ignorePunctuation:true}) || a.id.localeCompare(b.id));
}

export function readSaved(value, records) {
  try {
    const ids = JSON.parse(value || '[]');
    return new Set(Array.isArray(ids) ? ids.filter(id => records.some(record => record.id === id)) : []);
  } catch { return new Set(); }
}

export function imageHTML(media, name, alt, {sizes = '(max-width: 760px) 45vw, 24vw', priority = false, deferred = false, className = '', style = ''} = {}) {
  const image = media[name];
  if (!image) throw new Error(`No image variants for ${name}`);
  const fallback = image.variants[Math.min(1, image.variants.length - 1)];
  const srcset = image.variants.map(v => `${v.src} ${v.width}w`).join(', ');
  const prefix = deferred ? 'data-' : '';
  return `<img ${prefix}src="${fallback.src}" ${prefix}srcset="${srcset}" sizes="${sizes}" alt="${escapeHTML(alt)}" width="${image.width}" height="${image.height}" class="${className}"${style ? ` style="${style}"` : ''} ${priority ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"'} draggable="false">`;
}

export const coverHTML = (media, r, options) => imageHTML(media, r.image, `${r.release || r.album} — release artwork`, options);
export const videoLabel = r => r.videoType === 'live' ? 'Live performance' : r.videoType === 'music-video' ? 'Official music video' : r.videoType === 'lyric-video' ? 'Official lyric video' : 'Official audio';
export const youtubeConsentHTML = () => `<p class="player-consent" data-youtube-consent>Choose “Agree &amp; play” or “Agree &amp; play all” to connect to YouTube and accept <a href="/privacy-and-terms/">indiek’s privacy &amp; terms</a> and the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms</a>. YouTube receives device and request information. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.</p>`;
export const externalLink = (url, label, className = '') => `<a${className ? ` class="${className}"` : ''} href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)} <span aria-hidden="true">↗</span></a>`;

export function saveButton(r, long = false) {
  return `<button class="save-button" data-save="${r.id}"${long ? ' data-long-label' : ''} aria-label="Save ${escapeHTML(r.track)}" aria-pressed="false" data-js-only hidden>${long ? '+ Save track' : '+'}</button>`;
}
