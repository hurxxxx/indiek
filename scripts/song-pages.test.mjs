import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCatalogue} from './catalogue.mjs';
import {songPageStatus, readingPath, lyricsPath, similarSongs, songStructuredData} from './song-pages.mjs';
import {artistId, songPath, trackPath, getCatalogueTracks} from '../site/shared.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = () => JSON.parse(readFileSync(path.join(root, 'content/catalogue.json'), 'utf8'));
const catalogue = createCatalogue(source());
const tracks = getCatalogueTracks(catalogue);
const find = id => tracks.find(track => track.id === id);

test('song paths sit under the artist and leave track IDs and anchors unchanged', () => {
  assert.equal(songPath(find('hanroro')), '/artists/hanroro/even-if-you-leave/');
  assert.equal(songPath(find('youra-mimi')), '/artists/youra/mimi/');
  assert.equal(songPath(find('esegye')), '/artists/esegye/romance-youth-love/');
  assert.equal(trackPath(find('youra-mimi')), '/artists/youra/#listen');
  assert.equal(trackPath(find('youra-motif')), '/artists/youra/#track-youra-motif');
  assert.equal(new Set(tracks.map(songPath)).size, tracks.length);
});

test('a song page is indexed only with credits, Apple Music, sourced background and lyric notes', () => {
  const complete = find('mrch-surrender');
  assert.deepEqual(songPageStatus(complete), {path:'/artists/mrch/surrender/', ready:true, missing:[]});
  for (const [field, edit] of [
    ['credits', track => delete track.credits],
    ['apple-music', track => track.source = 'https://music.bugs.co.kr/album/20598166'],
    ['background', track => delete track.listeningNote],
    ['background', track => { delete track.extraSources; delete track.lyricNotes.backgroundSources; }],
    ['lyric-notes', track => delete track.lyricNotes],
  ]) {
    const changed = structuredClone(complete); edit(changed);
    const status = songPageStatus(changed);
    assert.equal(status.ready, false, field);
    assert.deepEqual(status.missing, [field]);
  }
  assert.deepEqual(songPageStatus(find('youra-mimi')).missing, ['apple-music', 'background']);
  assert.deepEqual(tracks.filter(track => songPageStatus(track).ready).map(track => track.id).sort(), ['hanroro', 'jeongmilla-departing-from-seoul-station', 'lang-lee-there-is-a-wolf', 'meaningful-stone-beep-boop-beep-boop', 'mrch-surrender', 'say-sue-me-old-town', 'silica-gel-no-pain', 'yerin-baek']);
});

test('reading and lyric links prefer a complete song page and otherwise keep the artist anchor', () => {
  assert.equal(readingPath(find('hanroro')), '/artists/hanroro/even-if-you-leave/');
  assert.equal(lyricsPath(find('hanroro')), '/artists/hanroro/even-if-you-leave/#lyrics');
  assert.equal(readingPath(find('youra-motif')), '/artists/youra/#track-youra-motif');
  assert.equal(lyricsPath(find('youra-motif')), '/artists/youra/#lyrics-youra-motif');
  assert.equal(lyricsPath(find('youra-mimi')), '/artists/youra/#lyrics');
});

test('every song gets three similar songs by other artists, each with a checkable reason', () => {
  for (const track of tracks) {
    const similar = similarSongs(track, catalogue);
    assert.equal(similar.length, 3, track.id);
    const voices = similar.flatMap(pick => [artistId(pick.track), ...(pick.track.featuredArtistIds || [])]);
    assert.ok(!voices.includes(artistId(track)), track.id);
    assert.equal(new Set(similar.map(pick => artistId(pick.track))).size, 3, track.id);
    assert.ok(similar.every(pick => pick.note?.trim()), track.id);
    assert.deepEqual(similarSongs(track, catalogue), similar, 'deterministic');
  }
  // The editor's "you might also like" suggestion in a curated guide comes first, with its own note.
  const [first] = similarSongs(find('hanroro'), catalogue);
  assert.equal(artistId(first.track), 'motte');
  assert.equal(first.guide.selection, 'curated');
  // Songs by the same artist do not all repeat the same neighbours.
  const youra = ['youra-flicker', 'youra-mimi', 'youra-motif'].map(id => similarSongs(find(id), catalogue).map(pick => pick.track.id).join());
  assert.equal(new Set(youra).size, 3);
});

test('song structured data points the recording and breadcrumb at the song page', () => {
  const [recording, breadcrumb] = songStructuredData(find('hanroro'), 'https://indiek.com');
  assert.equal(recording['@type'], 'MusicRecording');
  assert.equal(recording.url, 'https://indiek.com/artists/hanroro/even-if-you-leave/');
  assert.equal(recording.alternateName, '자처');
  assert.equal(recording.byArtist['@id'], 'https://indiek.com/artists/hanroro/#artist');
  assert.deepEqual(breadcrumb.itemListElement.map(item => item.item), ['https://indiek.com/', 'https://indiek.com/artists/', 'https://indiek.com/artists/hanroro/', recording.url]);
  assert.equal(songStructuredData(find('youra-mimi'), 'https://indiek.com')[0].datePublished, '2021-02-02');
  assert.equal(songStructuredData(find('yoon-mirae'), 'https://indiek.com')[0].datePublished, undefined, 'only ISO release dates are published');
});
