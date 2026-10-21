import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, cpSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCatalogue} from './catalogue.mjs';
import {getArtistRecords, getArtistDirectory, getFeaturedArtists, getListeningGuides, getPlaybackRecords, readSaved, searchCatalogue, artistId, artistPath, trackPath} from '../site/shared.mjs';
import {editorialEntries, relatedRecords} from '../site/editorial.mjs';
import {artistsForResearch} from './promotion/news.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = () => JSON.parse(readFileSync(path.join(root, 'content/catalogue.json'), 'utf8'));
function withSecondSong() {
  const data = source();
  // A synthetic title using an existing recording tests relationships, not new music.
  const first = data.tracks.find(track => track.id === 'gongwon');
  data.tracks.push({...structuredClone(first), id:'gongwon-test-track', track:'Relationship fixture', koreanTitle:'관계 검증'});
  data.tracks.at(-1).lyricNotes.paragraphs.push(`Synthetic markup fixture: <text> & "quotes" don't become HTML.`);
  return data;
}

test('existing saved IDs remain tracks, with the editor pick and full session excluded', () => {
  const catalogue = createCatalogue(source());
  const oldIDs = ['black-skirts','sunwoojunga','car-the-garden','choi-yu-ree','bol4','esegye','se-so-neon','ydbb','whiteusedsocks','motte','hanroro','kim-sawol','yerin-baek','gongwon','yebit'];
  assert.deepEqual(catalogue.records.map(track => track.id), oldIDs);
  assert.deepEqual([...readSaved(JSON.stringify([...oldIDs,'yoon-mirae','gongwon-live-0']), catalogue.records)], oldIDs);
  assert.equal(trackPath(catalogue.records.find(track => track.id === 'gongwon')), '/artists/gongwon/#listen');
});

test('every introduced song, including the editor pick, has sourced lyric commentary without mandatory quotations', () => {
  const data = source();
  for (const track of data.tracks) {
    assert.ok(track.lyricNotes, `Missing lyric notes: ${track.id}`);
    assert.ok(track.lyricNotes.paragraphs.length, track.id);
    assert.ok(track.lyricNotes.source.url.startsWith('https://'), track.id);
  }
  for (const track of data.tracks) delete track.lyricNotes.excerpt;
  assert.doesNotThrow(() => createCatalogue(data));
  // Older short quotations remain compatible, but an incomplete quotation must fail.
  data.tracks[0].lyricNotes.excerpt = {korean:'검증',english:'Fixture',note:'Synthetic test data.'};
  assert.doesNotThrow(() => createCatalogue(data));
});

test('the lyric review covers the exact current notes and every introduced track', () => {
  const data = source();
  const review = JSON.parse(readFileSync(path.join(root,'editorial/research/catalogue-lyric-notes.json'),'utf8'));
  const payload = data.tracks.map(t=>({trackId:t.id,lyricNotes:t.lyricNotes}));
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  assert.equal(review.revision.hash,hash,'Lyric notes changed: renew factual and editorial review.');
  assert.deepEqual(review.tracks.map(t=>t.trackId).sort(),data.tracks.map(t=>t.id).sort());
  for (const kind of ['facts','editorial']) {
    const pass = review.reviews.find(pass=>pass.kind===kind);
    assert.equal(pass?.approved,true,kind);
    assert.equal(pass.revision,hash,kind);
  }
});

test('a second song has independent playback and saving without duplicating its artist or full session', () => {
  const data = withSecondSong(), catalogue = createCatalogue(data);
  const added = catalogue.records.find(track => track.id === 'gongwon-test-track');
  assert.equal(trackPath(added), '/artists/gongwon/#track-gongwon-test-track');
  assert.equal(artistPath(added), '/artists/gongwon/');
  assert.equal(getArtistRecords(catalogue).length, data.artists.length);
  assert.equal(getFeaturedArtists(catalogue).filter(feature => feature.id === 'gongwon').length, 1);
  assert.deepEqual(getArtistDirectory(catalogue, {query:'관계 검증'}).map(artistId), ['gongwon']);
  assert.deepEqual(searchCatalogue(catalogue.records,catalogue.editorPick,'Relationship fixture').map(track => track.id), [added.id]);
  assert.deepEqual([...readSaved('["gongwon","gongwon-test-track"]',catalogue.records)], ['gongwon','gongwon-test-track']);
  assert.equal(getPlaybackRecords(catalogue).filter(track => track.id === 'gongwon-live-0').length, 1);
  const guides = getListeningGuides(catalogue);
  assert.ok(guides.find(guide => guide.id === 'guitars-and-bands').records.includes(added));
  const intro = guides.find(guide => guide.includeCatalogue);
  const introArtists = [...intro.records,...intro.moreRecords].map(artistId);
  assert.equal(new Set(introArtists).size, data.artists.length);
  assert.equal(introArtists.filter(id => id === 'gongwon').length, 1);
  assert.equal(editorialEntries(catalogue,guides).filter(entry => entry.path === '/artists/gongwon/').length, 1);
  assert.ok(relatedRecords(added,guides).records.every(track => artistId(track) !== 'gongwon'));
  assert.deepEqual(artistsForResearch({origin:data.site.url,items:[{kind:'artist',artistIds:['gongwon']}]},data).map(artist => artist.id), ['gongwon']);
});

test('artist identity and primary song identity may differ, with editorial notes remaining specific to a guide', () => {
  const data = withSecondSong();
  data.artists.find(artist => artist.id === 'gongwon').primaryTrackId = 'gongwon-test-track';
  const guide = data.listeningGuides.find(guide => guide.selection === 'curated');
  guide.trackIds[0] = 'gongwon';
  guide.trackNotes.gongwon = 'Only this guide uses this introduction.';
  guide.trackDetails.gongwon = {listenFor:'A guide-specific background.',nextArtistId:'ydbb',nextNote:'A different artist.'};
  const catalogue = createCatalogue(data);
  assert.equal(getArtistDirectory(catalogue,{query:'공원'})[0].id, 'gongwon-test-track');
  assert.equal(getFeaturedArtists(catalogue).filter(feature => feature.id === 'gongwon').length, 1);
  assert.equal(trackPath(catalogue.records.find(track => track.id === 'gongwon')), '/artists/gongwon/#track-gongwon');
  const resolvedGuide = getListeningGuides(catalogue).find(item => item.id === guide.id);
  assert.equal(resolvedGuide.trackNotes.gongwon, 'Only this guide uses this introduction.');
  assert.notEqual(resolvedGuide.records[0].note, resolvedGuide.trackNotes.gongwon);
  assert.ok(!resolvedGuide.moreRecords.some(track => artistId(track) === 'gongwon'));
});

for (const [label, edit, error] of [
  ['duplicate artists', data => data.artists.push(data.artists[0]), /duplicate artist ID/],
  ['duplicate tracks', data => data.tracks.push(data.tracks[0]), /duplicate track ID/],
  ['orphan tracks', data => data.tracks[0].artistId='missing', /primary track|Unknown artist/],
  ['foreign primary song', data => data.artists[0].primaryTrackId=data.tracks[1].id, /foreign primary track/],
  ['removed primary song', data => data.tracks.shift(), /primary track/],
  ['removed editor pick', data => data.editorPickTrackId='missing', /editor pick track/],
  ['missing recording format', data => delete data.tracks[0].videoType, /Missing .*\.videoType/],
  ['artist data duplicated on songs', data => data.tracks[0].artist='Another name', /Unknown track field/],
  ['unclassified song', data => data.tracks.find(track=>track.id==='hanroro').guideTags=[], /missing from listening guides/],
  ['broken guide reference', data => data.listeningGuides.find(guide=>guide.trackIds).trackIds[0]='missing', /Missing curated track/],
  ['broken feature reference', data => data.featuredArtists[0].id='missing', /Unknown featured artist/],
  ['duplicate performance identity', data => data.artists.find(artist=>artist.performances).performances[0].id=data.tracks[0].id, /Duplicate playback ID/],
  ['two authoring formats', data => data.records=[], /one source of truth/],
  ['empty lyric commentary', data => data.tracks[0].lyricNotes.paragraphs=[], /Invalid lyricNotes/],
  ['blank lyric paragraph', data => data.tracks[0].lyricNotes.paragraphs=[' '], /Invalid lyricNotes/],
  ['missing lyric source', data => delete data.tracks[0].lyricNotes.source, /Invalid lyricNotes/],
  ['unsafe lyric source', data => data.tracks[0].lyricNotes.source.url='javascript:alert(1)', /Invalid lyricNotes/],
  ['incomplete optional quotation', data => data.tracks[0].lyricNotes.excerpt={korean:'검증'}, /Invalid lyricNotes/],
  ['missing background citation', data => data.tracks[0].lyricNotes.backgroundSources=[{}], /Invalid lyricNotes/],
]) {
  test(`catalogue validation rejects ${label}`, () => {
    const data = source(); edit(data);
    assert.throws(() => createCatalogue(data), error);
  });
}

test('an isolated build renders multiple songs, unique anchors and artist counts through all public outputs', () => {
  const dir = mkdtempSync(path.join(tmpdir(),'indiek-catalogue-build-'));
  try {
    for (const folder of ['scripts','site','content','.openai']) cpSync(path.join(root,folder),path.join(dir,folder),{recursive:true});
    mkdirSync(path.join(dir,'dist'));
    cpSync(path.join(root,'dist/assets'),path.join(dir,'dist/assets'),{recursive:true});
    cpSync(path.join(root,'dist/favicon.svg'),path.join(dir,'dist/favicon.svg'));
    const data = withSecondSong();
    data.artists.find(artist=>artist.id==='gongwon').primaryTrackId = 'gongwon-test-track';
    writeFileSync(path.join(dir,'content/catalogue.json'),JSON.stringify(data));
    execFileSync('python3',['scripts/prepare-images.py'],{cwd:dir,stdio:'pipe'});
    execFileSync(process.execPath,['scripts/build.mjs'],{cwd:dir,stdio:'pipe'});
    execFileSync('python3',['scripts/check.py'],{cwd:dir,stdio:'pipe'});
    const page = readFileSync(path.join(dir,'dist/artists/gongwon/index.html'),'utf8');
    assert.match(page,/id="listen"/);
    assert.match(page,/id="track-gongwon"/);
    assert.match(page,/id="lyrics-gongwon"/);
    assert.match(page,/data-save="gongwon-test-track"/);
    assert.equal((page.match(/id="persistent-player"/g)||[]).length,1);
    assert.equal((page.match(/id="gongwon-live-0"/g)||[]).length,1);
    const home = readFileSync(path.join(dir,'dist/index.html'),'utf8');
    assert.match(home,/Browse all 16 artists/);
    assert.match(home,/data-room-count="17"/);
    assert.match(home,/href="\/artists\/gongwon\/#track-gongwon"/);
    const promotion = JSON.parse(readFileSync(path.join(dir,'dist/promotion-catalogue.json'),'utf8'));
    assert.equal(promotion.items.filter(item=>item.kind==='artist'&&item.id==='gongwon').length,1);
    for (const item of promotion.items) assert.equal(new Set(item.artistIds).size,item.artistIds.length);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
