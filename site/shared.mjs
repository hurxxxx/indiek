export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const artistPath = record => `/artists/${record.id}/`;
export const normalizeSearch = value => String(value).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

export function searchCatalogue(records, pick, query) {
  const compact = normalizeSearch(query);
  const words = query.trim().split(/\s+/).map(normalizeSearch).filter(Boolean);
  return [...records, pick].filter(record => {
    const text = normalizeSearch([record.artist, record.korean, record.aliases, record.track, record.koreanTitle, record.release, record.genre, record.category].filter(Boolean).join(' '));
    return text.includes(compact) || words.every(word => text.includes(word));
  });
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
export const videoLabel = r => r.videoType === 'live' ? 'Live performance' : r.videoType === 'music-video' ? 'Official music video' : 'Official audio';
export const externalLink = (url, label, className = '') => `<a${className ? ` class="${className}"` : ''} href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)} <span aria-hidden="true">↗</span></a>`;

export function saveButton(r, long = false) {
  return `<button class="save-button" data-save="${r.id}"${long ? ' data-long-label' : ''} aria-label="Save ${escapeHTML(r.track)}" aria-pressed="false" data-js-only hidden>${long ? '+ Save track' : '+'}</button>`;
}
