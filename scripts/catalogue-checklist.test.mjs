// The AGENTS.md "콘텐츠 변경 시 함께 확인" items that a machine can check, run over the whole
// catalogue so adding many songs does not need a hand check of every location. Page-level items
// (links, anchors, counts, sitemap, guides, Saved buttons) are in scripts/check.py.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCatalogue} from './catalogue.mjs';
import {artistId, getArtistDirectory, getArtistRecords, getCatalogueTracks, searchCatalogue} from '../site/shared.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
const source = read('content/catalogue.json');
const catalogue = createCatalogue(structuredClone(source));
const tracks = getCatalogueTracks(catalogue);
const artists = getArtistRecords(catalogue);
const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);

test('every artist is found in Artists by English name, Korean name and each song title, under its own filter', () => {
  for (const artist of artists) {
    const id = artistId(artist);
    const own = tracks.filter(t => artistId(t) === id);
    for (const query of [artist.artist, artist.korean, ...own.flatMap(t => [t.track, t.koreanTitle])].filter(Boolean)) {
      assert.ok(getArtistDirectory(catalogue, {query}).some(r => artistId(r) === id), `${id} not found by “${query}”`);
      assert.ok(getArtistDirectory(catalogue, {query, category:artist.category}).some(r => artistId(r) === id), `${id} missing under ${artist.category} for “${query}”`);
    }
    assert.equal(getArtistDirectory(catalogue, {category:artist.category === 'solo' ? 'bands' : 'solo'}).some(r => artistId(r) === id), false, `${id} appears under the wrong filter`);
  }
  for (const track of tracks) assert.ok(searchCatalogue(catalogue.records, catalogue.editorPick, track.track).includes(track), `Song search misses ${track.id}`);
});

test('release links use the English Apple Music storefront and recordings match their declared format', () => {
  for (const track of tracks) {
    const url = new URL(track.source);
    if (url.hostname === 'music.apple.com') assert.ok(url.pathname.startsWith('/us/'), `${track.id}: Apple Music link must be the US (English) storefront`);
    if (/ - Topic$/.test(track.channel)) assert.equal(track.videoType, 'audio', `${track.id}: a YouTube Topic upload is official audio`);
  }
  const videos = tracks.map(t => t.videoId);
  assert.equal(new Set(videos).size, videos.length, 'Two songs use the same recording');
});

test('no two songs share a cover, so artist pages, guides and similar-song lists never repeat one', () => {
  const seen = new Map();
  for (const track of source.tracks) {
    assert.ok(!seen.has(track.image), `${track.id} and ${seen.get(track.image)} share ${track.image}; choose a song from another release`);
    seen.set(track.image, track.id);
  }
});

test('lyric notes explain rather than reproduce lyrics; adaptations are explicitly requested and recorded', () => {
  const research = readdirSync(path.join(root, 'editorial/research')).map(f => readFileSync(path.join(root, 'editorial/research', f), 'utf8')).join('\n');
  for (const track of tracks.filter(t => t.lyricNotes)) {
    const notes = track.lyricNotes;
    for (const text of [notes.heading, ...notes.themes, ...notes.paragraphs]) {
      const runs = text.match(/[가-힣][가-힣\s,.!?~]*/g) || [];
      assert.ok(runs.every(run => run.trim().length <= 30), `${track.id}: Korean quotation longer than a short phrase`);
    }
    if (notes.excerpt) assert.ok(notes.excerpt.korean.length <= 40 && !notes.excerpt.korean.includes('\n'), `${track.id}: excerpt longer than a brief quotation`);
    if (notes.translation) assert.ok(research.includes(`"${track.id}"`), `${track.id}: an English adaptation needs its request and provenance in editorial/research`);
  }
});

// Counts come from the catalogue at build time; copy must not freeze today's totals as the site's scope.
test('editable copy does not hard-code the number of artists or songs', () => {
  const words = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
  const tens = {twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90};
  const value = word => /^\d+$/.test(word) ? Number(word) : words.includes(word) ? words.indexOf(word) : (([t, u]) => (tens[t] ?? NaN) + (u ? words.indexOf(u) : 0))(word.split(/[-\s]/));
  const totals = new Set([artists.length, tracks.length, catalogue.records.length]);
  const home = read('content/home.json');
  const copy = [JSON.stringify(home.sections.map(s => s.copy)), home.title, home.description, ...source.listeningGuides.flatMap(g => [g.title, g.description, g.intro, g.seoTitle, g.seoDescription, ...(g.paragraphs || [])])].filter(Boolean).join('\n');
  for (const match of copy.matchAll(/\b(\d+|[a-z]+(?:[-\s][a-z]+)?)\s+(?:korean\s+)?(artists|songs|tracks|musicians|singers|bands)\b/gi)) {
    assert.ok(!totals.has(value(match[1].toLowerCase())), `Copy fixes a catalogue total: “${match[0]}”`);
  }
});

test('publication dates are real days, never in the future, and updates do not predate publication', () => {
  const valid = day => /^\d{4}-\d{2}-\d{2}$/.test(day) && new Date(day).toISOString().slice(0, 10) === day;
  for (const artist of source.artists) {
    const {published, updated} = artist.editorial || {};
    if (published) assert.ok(valid(published) && published <= today, `${artist.id}: publication date must be a real past day`);
    if (updated) assert.ok(valid(updated) && updated <= today && (!published || updated >= published), `${artist.id}: invalid update date`);
  }
});

test('every source and image credit is a complete https record', () => {
  const https = url => { try { return new URL(url).protocol === 'https:'; } catch { return false; } };
  for (const artist of source.artists) assert.ok(https(artist.artistSource) && artist.artistSourceName.trim() && artist.artistSourceLanguage.trim(), artist.id);
  for (const track of source.tracks) {
    assert.ok(https(track.source) && track.sourceName.trim(), track.id);
    for (const s of [...(track.extraSources || []), ...(track.lyricNotes?.backgroundSources || [])]) assert.ok(https(s.url) && s.label?.trim(), `${track.id}: incomplete source`);
  }
  const rights = read('content/image-rights.json').images;
  for (const track of source.tracks) {
    const image = rights.find(i => i.file === track.image);
    assert.ok(image && https(image.source) && image.credit?.trim() && image.label?.trim(), `${track.id}: artwork ${track.image} needs a credited source`);
  }
});
