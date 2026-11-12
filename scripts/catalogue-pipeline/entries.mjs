// Turning research, verified recordings and a reviewed draft into catalogue entries. Identity,
// recording and release fields are filled from checked data here, never from model prose.
import {createCatalogue} from '../catalogue.mjs';
import {digest} from '../editorial/content.mjs';
import {normalizeName, slugify} from './candidates.mjs';
import {formatDuration} from './playback.mjs';

export const songSlug = title => slugify(String(title).replace(/\s*[([](feat\.?|featuring|with|prod\.?)[^)\]]*[)\]]/gi, ''));
const hangul = value => /[가-힣]/.test(value || '');
const https = url => { try { const u = new URL(url); return u.protocol === 'https:' && Boolean(u.hostname); } catch { return false; } };
const cleanSource = s => s && https(s.url) && s.label?.trim() ? {url:s.url, label:s.label.trim(), language:s.language?.trim() || 'Korean'} : null;
const uniqueSources = list => list.map(cleanSource).filter(Boolean).filter((s, i, all) => all.findIndex(x => x.url === s.url) === i);

// Artist fields a review covers. Publication dates, the opening song and extra links can change
// without changing what was checked.
const ARTIST_REVIEWED = ['artist','korean','aliases','category','artistIntro','biography','artistSource','artistSourceName','artistSourceLanguage'];
export const reviewedArtist = artist => Object.fromEntries(ARTIST_REVIEWED.filter(k => artist?.[k] !== undefined).map(k => [k, artist[k]]));
export const entryHash = (artist, track) => digest({artist:reviewedArtist(artist), track});

export const isAppleMusic = url => { try { const u = new URL(url); return u.hostname === 'music.apple.com' && u.pathname.startsWith('/us/'); } catch { return false; } };
export const backgroundSourcesOf = track => [...(track.extraSources || []), ...(track.lyricNotes?.backgroundSources || [])];
// Grade A: complete song page with lyric notes (music notes for an instrumental piece). Grade B:
// everything except those notes.
export function gradeMissing(track, grade) {
  const missing = [];
  if (!track.credits?.trim()) missing.push('credits');
  if (!isAppleMusic(track.source)) missing.push('English Apple Music link');
  if (!track.listeningNote?.trim() || !backgroundSourcesOf(track).length) missing.push('sourced background');
  if (!track.description?.trim() || !track.note?.trim()) missing.push('short introduction');
  if (!/^[\w-]{11}$/.test(track.videoId || '')) missing.push('official recording');
  if (grade === 'A' && !track.lyricNotes?.paragraphs?.length) missing.push(track.instrumental ? 'music notes' : 'lyric notes');
  if (grade === 'B' && track.lyricNotes) missing.push('grade B must not carry unreviewed lyric notes');
  return missing;
}

export function appleIds(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== 'music.apple.com') return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const id = parts.at(-1);
    if (parts[1] === 'song') return {song:id};
    if (parts[1] === 'album') return {album:id, song:u.searchParams.get('i') || null};
  } catch {}
  return null;
}

const koreanDate = iso => iso ? new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 10) : undefined;

// Confirms an English Apple Music page for this exact song through the public iTunes lookup API.
export async function lookupRelease({url, title, artistName}, fetcher = fetch) {
  const ids = appleIds(url);
  if (!ids) return {ok:false, reason:`Not an Apple Music URL: ${url}`};
  const lookup = async id => {
    const response = await fetcher(`https://itunes.apple.com/lookup?id=${id}&entity=song&country=us`, {signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error(`iTunes ${response.status}`);
    return (await response.json()).results || [];
  };
  const results = await lookup(ids.song || ids.album);
  const songs = results.filter(r => r.wrapperType === 'track' && r.kind === 'song');
  const wanted = normalizeName(songSlug(title));
  const song = songs.find(r => String(r.trackId) === ids.song) || songs.find(r => normalizeName(songSlug(r.trackName)) === wanted);
  if (!song) return {ok:false, reason:`Apple Music (US) has no song matching “${title}” at ${url}`};
  const names = [artistName].flat().map(normalizeName);
  if (!names.some(n => normalizeName(song.artistName).includes(n))) return {ok:false, reason:`Apple Music credits ${song.artistName}, not ${[artistName].flat().join(' / ')}`};
  const collectionURL = song.collectionViewUrl.replace(/\?.*$/, '');
  // A track's own date is when the song first appeared (often an earlier single); the entry names
  // the release that carries it, so its date is the collection's, as a Korean calendar day.
  const collection = results.find(r => r.wrapperType === 'collection' && r.collectionId === song.collectionId) || (await lookup(song.collectionId)).find(r => r.wrapperType === 'collection');
  return {ok:true, trackName:song.trackName, artistName:song.artistName, collectionName:song.collectionName, collectionURL:collectionURL.replace(/\/album\/[^/]+\//, `/album/${slugify(song.collectionName) || 'album'}/`),
    releaseDate:koreanDate(collection?.releaseDate || song.releaseDate), trackReleaseDate:koreanDate(song.releaseDate), durationSeconds:Math.round((song.trackTimeMillis || 0) / 1000), artwork:song.artworkUrl100?.replace(/\/\d+x\d+bb\.jpg$/, '/1200x1200bb.jpg'), checkedAt:new Date().toISOString()};
}

const dayDiff = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
export function trackId(artistId, title) { return `${artistId}-${songSlug(title)}`; }

// unit: {artistId, existing, artist?: existing artist entry, tracks:[{key, role, grade}]}
export function assembleEntries({unit, dossier, draft, releases, videos, existingArtists = [], images = new Map(), day}) {
  const artistName = unit.existing ? unit.artist.artist : dossier.artist.name.trim();
  const tracks = unit.tracks.filter(t => releases[t.key]?.ok && videos[t.key]?.playing).map(t => {
    const research = dossier.tracks[t.index], text = draft.tracks.find(d => d.key === t.key) || {}, release = releases[t.key], video = videos[t.key];
    const title = release.trackName;
    const album = release.collectionName.replace(/\s+-\s+(Single|EP)$/i, '');
    const date = /^\d{4}-\d{2}-\d{2}$/.test(research.releaseDate) && dayDiff(research.releaseDate, release.releaseDate) <= 1 ? research.releaseDate : release.releaseDate;
    let image = `${unit.artistId}-${slugify(album)}.jpg`;
    for (let n = 2; images.has(image) && images.get(image) !== release.artwork; n++) image = `${unit.artistId}-${slugify(album)}-${n}.jpg`;
    // Guests link by an artist's own English or Korean name only: aliases also hold member and solo
    // names (So!YoON! is listed under SE SO NEON), and a solo feature is not the band's.
    const featured = (research.featuredArtists || []).map(name => existingArtists.find(a => [a.artist, a.korean].map(normalizeName).includes(normalizeName(name)))?.id).filter(id => id && id !== unit.artistId);
    const videoType = / - Topic$/.test(video.channel) ? 'audio' : video.videoType;
    const entry = {
      id:trackId(unit.artistId, title), artistId:unit.artistId, slug:songSlug(title),
      ...(featured.length ? {featuredArtistIds:[...new Set(featured)]} : {}),
      album, release:release.collectionName, year:date.slice(0, 4), releaseDate:date,
      genre:text.genre?.trim().toUpperCase() || '', image, track:title,
      ...(hangul(research.korean) && normalizeName(research.korean) !== normalizeName(title) ? {koreanTitle:research.korean.trim()} : {}),
      duration:formatDuration(video.duration || release.durationSeconds), provider:'youtube', videoId:video.videoId, channel:video.channel,
      url:`https://www.youtube.com/watch?v=${video.videoId}`, videoType,
      ...(research.instrumental === true ? {instrumental:true} : {}),
      note:text.note?.trim() || '', description:text.description?.trim() || '',
      source:release.collectionURL, sourceName:`${release.artistName} — ${release.collectionName} on Apple Music`, sourceLanguage:'English',
      extraSources:uniqueSources(text.extraSources || []), guideTags:[...new Set(text.guideTags || [])],
      listeningNote:text.listeningNote?.trim() || '', credits:text.credits?.trim() || '',
    };
    if (!entry.extraSources.length) delete entry.extraSources;
    if (t.grade === 'A' && text.lyricNotes?.paragraphs?.length) {
      const notes = text.lyricNotes;
      entry.lyricNotes = {heading:notes.heading.trim(), themes:notes.themes.map(s => s.trim()).filter(Boolean), paragraphs:notes.paragraphs.map(s => s.trim()).filter(Boolean), source:cleanSource(notes.source) || notes.source};
      const background = uniqueSources(notes.backgroundSources || []);
      if (background.length) entry.lyricNotes.backgroundSources = background;
    }
    return {key:t.key, grade:t.grade, role:t.role, entry, release, video};
  });
  const primary = tracks.find(t => t.role === 'primary') || tracks[0];
  const artist = unit.existing ? null : primary && {
    id:unit.artistId, primaryTrackId:primary.entry.id, artist:artistName, korean:dossier.artist.korean.trim(),
    ...(draft.artist.aliases?.trim() ? {aliases:draft.artist.aliases.trim()} : {}),
    category:draft.artist.category || dossier.artist.category, artistIntro:draft.artist.artistIntro.trim(),
    artistSource:draft.artist.artistSource, artistSourceName:draft.artist.artistSourceName.trim(), artistSourceLanguage:draft.artist.artistSourceLanguage.trim() || 'Korean',
    biography:draft.artist.biography.trim(), editorial:{author:'indiek', updated:day},
  };
  return {artist, tracks};
}

const PROSE = ['artistIntro','biography','note','description','listeningNote'];
const FIRST_PERSON = /(^|[^\p{L}’'])(I|I’m|I'm|I’ve|I've|I’d|I'd|my|me|mine|we|we’re|we're|our|us)(?=$|[^\p{L}’'])/u;
const STOCK = /\b(hidden gem|sonic journey|transcends? language|must[- ]listen|masterpiece|you(’|')ll (love|feel|hear)|you will (love|feel|hear)|listen (closely|carefully|for)|put (it|this) on|perfect for)\b/i;
const outsideQuotes = text => String(text).replace(/“[^”]*”|"[^"]*"/g, '');

// Deterministic checks before any review call: model validity, grades and the house rules a
// machine can see. Judgement about voice and interpretation stays with the independent review.
export function lintEntries({artist, tracks}, {source, unit}) {
  const issues = [];
  const data = structuredClone(source);
  if (artist) data.artists.push(artist);
  for (const t of tracks) data.tracks.push(t.entry);
  try { createCatalogue(data); } catch (error) { issues.push(`Catalogue validation: ${error.message}`); }
  if (!unit.existing && !artist) issues.push('No track survived release and playback checks, so the artist cannot be added');
  if (unit.existing === false && !tracks.some(t => t.role === 'primary')) issues.push('The primary song failed its checks; choose another primary song');
  const texts = [];
  if (artist) {
    for (const k of ['artistIntro','biography','artistSourceName']) if (!artist[k]?.trim()) issues.push(`Artist ${k} is empty`);
    if (!https(artist.artistSource)) issues.push('Artist source must be an https URL');
    texts.push(...['artistIntro','biography'].map(k => [`artist.${k}`, artist[k]]));
    if (artist.artistIntro?.split(/(?<=[.!?])\s+/).length > 3) issues.push('artistIntro: keep the first introduction to one or two sentences');
  }
  for (const {key, grade, entry} of tracks) {
    for (const missing of gradeMissing(entry, grade)) issues.push(`${key} (${entry.id}): grade ${grade} needs ${missing}`);
    if (!entry.genre) issues.push(`${key}: genre is empty`);
    if (entry.note.length > 80) issues.push(`${key}: note is ${entry.note.length} characters; keep it under about 70`);
    if (!entry.guideTags.length && entry.videoType !== 'live') issues.push(`${key}: needs a guide tag so automatic guides cover it`);
    for (const s of backgroundSourcesOf(entry)) if (!https(s.url) || !s.label) issues.push(`${key}: incomplete source ${s.url}`);
    texts.push(...PROSE.map(k => [`${key}.${k}`, entry[k]]));
    if (entry.lyricNotes) {
      const notes = entry.lyricNotes;
      if (!https(notes.source?.url)) issues.push(`${key}: ${entry.instrumental ? 'music notes need the page that describes the music' : 'lyric notes need the lyric source page'}`);
      if (notes.paragraphs.length > 4) issues.push(`${key}: lyric notes run to ${notes.paragraphs.length} paragraphs; two or three are enough`);
      notes.paragraphs.forEach((p, i) => texts.push([`${key}.lyricNotes.paragraphs[${i}]`, p]));
      for (const p of notes.paragraphs) {
        const runs = p.match(/[가-힣][가-힣\s,.!?~]*/g) || [];
        if (runs.some(r => r.trim().length > 30)) issues.push(`${key}: a Korean quotation longer than a short phrase; paraphrase instead of quoting lyrics`);
        const quoted = p.match(/“[^”]{60,}”/g);
        if (quoted) issues.push(`${key}: a long quotation; quote at most a short phrase`);
      }
    }
  }
  for (const [field, text] of texts) {
    if (!text) continue;
    if (FIRST_PERSON.test(outsideQuotes(text))) issues.push(`${field}: first-person voice suggests an invented listening experience; describe the documented song instead`);
    const stock = outsideQuotes(text).match(STOCK);
    if (stock) issues.push(`${field}: “${stock[0]}” stands in for a specific observation or tells readers what to feel`);
  }
  return issues;
}

// Every page a published claim depends on; Apple Music and YouTube are verified by API instead.
export function citedSources({artist, tracks}) {
  const urls = [];
  if (artist) urls.push(artist.artistSource);
  for (const {entry} of tracks) urls.push(...backgroundSourcesOf(entry).map(s => s.url), ...(entry.lyricNotes ? [entry.lyricNotes.source.url] : []));
  return [...new Set(urls.filter(Boolean))];
}

// Official-channel rule, checked against oEmbed data rather than a model's claim: the artist's own
// channel (its name contains the artist name), the artist's YouTube Topic channel, or a label,
// distributor, broadcaster or live series recorded in editorial/catalogue/official-channels.json.
const UNOFFICIAL = /\b(fan|fans|lyrics?|cover|reaction|kpop|k-pop|drama|ost|playlist|archive|sub|subs|8d|nightcore)\b/i;
export function officialBasis({channel, channelURL}, artistNames, allowlist = []) {
  const listed = allowlist.find(c => c.channelURL === channelURL);
  if (listed) return `${listed.kind} channel on the official-channel list (${listed.basis})`;
  // "&" and "and" are the same name ("Danpyunsun & The Moments Ensemble").
  const key = value => normalizeName(String(value || '').replace(/&/g, ' and '));
  const names = artistNames.map(key).filter(n => n.length >= 2);
  const topic = /^(.*) - Topic$/.exec(channel || '');
  if (topic && names.includes(key(topic[1]))) return 'the artist’s YouTube Topic channel (official audio)';
  if (!topic && !UNOFFICIAL.test(channel || '') && names.some(n => key(channel).includes(n))) return 'the artist’s own channel';
  return null;
}

// The declared format must be visible in the official title (or implied by a live-series or
// broadcaster channel); otherwise the next candidate is tried rather than mislabelling a video.
const LIVE = /live|라이브|session|세션|concert|콘서트|공연|stage|스테이지|tour|투어|busking|버스킹|open ?mic|오픈마이크|unplugged|언플러그드/i;
export function formatConfirmed(videoType, {title, channelURL}, allowlist = []) {
  const kind = allowlist.find(c => c.channelURL === channelURL)?.kind;
  if (videoType === 'live') return LIVE.test(title || '') || ['live-series','broadcaster'].includes(kind);
  if (videoType === 'lyric-video') return /lyric|가사/i.test(title || '');
  return true;
}
