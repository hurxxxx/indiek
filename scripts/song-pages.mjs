import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {artistId, artistPath, trackPath, songPath, getArtistRecords, getCatalogueTracks, getListeningGuides} from '../site/shared.mjs';
import {loadCatalogue} from './catalogue.mjs';

const isAppleMusic = url => { try { return new URL(url).hostname === 'music.apple.com'; } catch { return false; } };
export const backgroundSources = track => [...(track.extraSources || []), ...(track.lyricNotes?.backgroundSources || [])];

// A song page is indexed only when it adds verified information beyond the artist page:
// credits, an Apple Music release link, sourced background and lyric notes (music notes for an
// instrumental piece). Missing fields are
// never filled with placeholders; the page stays noindex and out of the sitemap until they exist.
export function songPageStatus(track) {
  const missing = [];
  if (!track.credits?.trim()) missing.push('credits');
  if (!isAppleMusic(track.source)) missing.push('apple-music');
  if (!track.listeningNote?.trim() || !backgroundSources(track).length) missing.push('background');
  if (!track.lyricNotes) missing.push('lyric-notes');
  return {path:songPath(track), ready:Boolean(songPath(track)) && !missing.length, missing};
}

// Links that promise reading go to an indexable song page, otherwise to the existing artist anchor.
export const readingPath = track => songPageStatus(track).ready ? songPath(track) : trackPath(track);

export const lyricsAnchor = track => track.primaryTrackId && track.id !== track.primaryTrackId ? `lyrics-${track.id}` : 'lyrics';
export const lyricsPath = track => songPageStatus(track).ready ? `${songPath(track)}#lyrics` : `${artistPath(track)}#${lyricsAnchor(track)}`;

// Three songs by other artists, each with a reason that can be checked on the site:
// an editorial "next" suggestion first, then shared themed guides (not the live-format guide).
// Within a guide, start after the song's own position so pages do not all repeat the same three.
export function similarSongs(track, catalogue, {limit = 3, guides = getListeningGuides(catalogue)} = {}) {
  const artists = getArtistRecords(catalogue);
  const tracks = getCatalogueTracks(catalogue);
  const picks = [];
  const add = (other, reason) => {
    // One song per artist, counting featured artists, so a collaboration does not repeat a voice.
    const voices = record => [artistId(record), ...(record.featuredArtistIds || [])];
    const taken = new Set([track, ...picks.map(pick => pick.track)].flatMap(voices));
    if (!other || voices(other).some(id => taken.has(id))) return;
    picks.push({track:other, ...reason});
  };
  for (const guide of guides.filter(guide => guide.selection === 'curated')) {
    const detail = guide.trackDetails?.[track.id];
    if (detail) add(artists.find(record => artistId(record) === detail.nextArtistId), {note:detail.nextNote, guide});
  }
  const themed = guides.filter(guide => guide.selection === 'tag' && guide.records.includes(track));
  const shared = other => themed.filter(guide => guide.records.includes(other)).length;
  const ordered = themed.flatMap(guide => {
    const at = guide.records.indexOf(track);
    return [...guide.records.slice(at + 1), ...guide.records.slice(0, at)].map(other => ({other, guide}));
  });
  const ranked = ordered.map((item, order) => ({...item, order, score:shared(item.other)})).sort((a, b) => b.score - a.score || a.order - b.order)
    .filter(({other}) => artistId(other) !== artistId(track));
  // Songs by the same artist sit together in a guide; give each one a different window of neighbours.
  const offset = (tracks.filter(other => artistId(other) === artistId(track)).indexOf(track) * limit) % Math.max(ranked.length, 1);
  for (const {other, guide} of [...ranked.slice(offset), ...ranked.slice(0, offset)]) add(other, {note:other.note, guide});
  for (const other of tracks) add(other, {note:other.note, guide:null});
  return picks.slice(0, limit);
}

export function songStructuredData(track, siteURL) {
  const artistURL = siteURL + artistPath(track);
  const url = siteURL + songPath(track);
  const released = /^\d{4}-\d{2}-\d{2}$/.test(track.releaseDate || '') ? {datePublished:track.releaseDate} : {};
  return [
    {'@type':'MusicRecording','@id':`${url}#recording`,name:track.track,...(track.koreanTitle ? {alternateName:track.koreanTitle} : {}),url,
      byArtist:{'@type':'MusicGroup','@id':`${artistURL}#artist`,name:track.artist,url:artistURL},
      ...(track.release ? {inAlbum:{'@type':'MusicAlbum',name:track.release}} : {}),...released},
    {'@type':'BreadcrumbList',itemListElement:[['indiek',`${siteURL}/`],['Artists',`${siteURL}/artists/`],[track.artist,artistURL],[track.track,url]]
      .map(([name, item], i) => ({'@type':'ListItem',position:i + 1,name,item}))},
  ];
}

// The Python page checker reads song page status from here instead of re-implementing the rule.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalogue = loadCatalogue(process.argv[2] || fileURLToPath(new URL('../', import.meta.url)));
  const tracks = getCatalogueTracks(catalogue);
  process.stdout.write(JSON.stringify(Object.fromEntries(tracks.filter(songPath).map(track => [track.id, {
    ...songPageStatus(track), similar:similarSongs(track, catalogue).map(pick => pick.track.id),
  }]))));
}
