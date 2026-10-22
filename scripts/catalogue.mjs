import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {getListeningGuides, getFeaturedArtists, getPlaybackRecords} from '../site/shared.mjs';

const artistFields = new Set(['id','primaryTrackId','artist','korean','aliases','category','artistIntro','biography','artistSource','artistSourceName','artistSourceLanguage','editorial','moreTracks','performances']);
const trackFields = new Set(['id','artistId','album','release','releaseYear','year','releaseDate','genre','image','track','koreanTitle','duration','provider','videoId','channel','url','videoType','performance','note','description','source','sourceName','sourceLanguage','extraSources','guideTags','listeningNote','credits','lyricNotes','externalOnly']);
const validId = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
function index(items, kind, fields) {
  if (!Array.isArray(items) || !items.length) throw new Error(`Missing ${kind} list`);
  const result = new Map();
  for (const item of items) {
    if (!item || !validId(item.id) || result.has(item.id)) throw new Error(`Invalid or duplicate ${kind} ID: ${item?.id}`);
    for (const key of Object.keys(item)) if (!fields.has(key)) throw new Error(`Unknown ${kind} field ${item.id}.${key}`);
    result.set(item.id, item);
  }
  return result;
}
function required(item, fields) {
  for (const field of fields) if (typeof item[field] !== 'string' || !item[field].trim()) throw new Error(`Missing ${item.id}.${field}`);
}

function validateLyricNotes(track) {
  const notes = track.lyricNotes;
  if (notes === undefined) return;
  const fail = field => { throw new Error(`Invalid lyricNotes: ${track.id}.${field}`); };
  const text = value => typeof value === 'string' && Boolean(value.trim());
  if (!notes || typeof notes !== 'object' || Array.isArray(notes)) fail('lyricNotes');
  const fields = ['heading','themes','paragraphs','source','backgroundSources','excerpt','translation'];
  for (const key of Object.keys(notes)) if (!fields.includes(key)) fail(key);
  if (!text(notes.heading)) fail('heading');
  for (const key of ['themes','paragraphs']) {
    if (!Array.isArray(notes[key]) || (!notes[key].length && !(key === 'paragraphs' && notes.translation)) || !notes[key].every(text)) fail(key);
  }
  if (notes.translation !== undefined) {
    const translation = notes.translation;
    if (!translation || typeof translation !== 'object' || Array.isArray(translation)) fail('translation');
    if (Object.keys(translation).some(key=>!['label','stanzas'].includes(key)) || !text(translation.label)) fail('translation.label');
    if (!Array.isArray(translation.stanzas) || !translation.stanzas.length || !translation.stanzas.every(text)) fail('translation.stanzas');
  }
  if (notes.backgroundSources !== undefined && !Array.isArray(notes.backgroundSources)) fail('backgroundSources');
  for (const source of [notes.source,...(notes.backgroundSources || [])]) {
    if (!source || !text(source.label) || !text(source.language)) fail('source');
    let url;
    try { url = new URL(source.url); } catch { fail('source.url'); }
    if (url.protocol !== 'https:' || !url.hostname) fail('source.url');
  }
  if (notes.excerpt !== undefined && (!notes.excerpt || !['korean','english','note'].every(key=>text(notes.excerpt[key])))) fail('excerpt');
}

// This is the only conversion from authoring data to the site's existing record views.
// IDs belong to tracks, including historical IDs that happen to equal an artist ID.
export function createCatalogue(source) {
  if (source.schemaVersion !== 2) throw new Error('Expected catalogue schemaVersion 2');
  if ('records' in source || 'editorPick' in source) throw new Error('Catalogue must have one source of truth: artists, tracks and editorPickTrackId');
  const artists = index(source.artists, 'artist', artistFields);
  const tracks = index(source.tracks, 'track', trackFields);
  for (const artist of artists.values()) {
    required(artist, ['artist','korean','artistIntro','artistSource','artistSourceName','primaryTrackId']);
    if (!['solo','bands'].includes(artist.category)) throw new Error(`Invalid artist category: ${artist.id}`);
    if (tracks.get(artist.primaryTrackId)?.artistId !== artist.id) throw new Error(`Missing or foreign primary track: ${artist.id}/${artist.primaryTrackId}`);
  }
  for (const track of tracks.values()) {
    if (!artists.has(track.artistId)) throw new Error(`Unknown artist for track ${track.id}: ${track.artistId}`);
    required(track, ['track','image','year','genre','note','description','source','sourceName','channel','url','videoType']);
    validateLyricNotes(track);
    if (track.provider !== 'youtube' || !/^[\w-]{11}$/.test(track.videoId)) throw new Error(`Invalid YouTube recording: ${track.id}`);
    if (track.videoType && !['live','music-video','lyric-video','audio'].includes(track.videoType)) throw new Error(`Invalid videoType: ${track.id}`);
    const videoURL = new URL(track.url);
    if (videoURL.protocol !== 'https:' || videoURL.hostname !== 'www.youtube.com' || videoURL.searchParams.get('v') !== track.videoId) throw new Error(`Mismatched video URL: ${track.id}`);
  }
  if (!tracks.has(source.editorPickTrackId)) throw new Error(`Unknown editor pick track: ${source.editorPickTrackId}`);
  const resolved = source.tracks.map(track => {
    const {id, ...artist} = artists.get(track.artistId);
    return {...artist, ...track};
  });
  const catalogue = {
    site: source.site,
    records: resolved.filter(track => track.id !== source.editorPickTrackId),
    featuredArtists: source.featuredArtists,
    editorPick: resolved.find(track => track.id === source.editorPickTrackId),
    listeningGuides: source.listeningGuides,
  };
  getFeaturedArtists(catalogue);
  getListeningGuides(catalogue);
  getPlaybackRecords(catalogue);
  return catalogue;
}

export function loadCatalogue(root) {
  return createCatalogue(JSON.parse(readFileSync(path.join(root, 'content/catalogue.json'), 'utf8')));
}

// The Python page checker uses this same conversion instead of maintaining a second one.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify(loadCatalogue(process.argv[2] || fileURLToPath(new URL('../', import.meta.url)))));
}
