import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, cpSync, copyFileSync, mkdirSync, mkdtempSync, rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCatalogue} from './catalogue.mjs';
import {songPageStatus} from './song-pages.mjs';
import {mergeCandidates, scoreCandidates, searchDemand, slugify, normalizeName} from './catalogue-pipeline/candidates.mjs';
import {parseSearchConsoleCSV} from './catalogue-pipeline/context.mjs';
import {songSlug, assembleEntries, lintEntries, entryHash, gradeMissing, citedSources, appleIds, officialBasis, formatConfirmed} from './catalogue-pipeline/entries.mjs';
import {prepareUnit, approval} from './catalogue-pipeline/tracks.mjs';
import {humanSample, rightsEntry} from './catalogue-pipeline/apply.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = () => JSON.parse(readFileSync(path.join(root, 'content/catalogue.json'), 'utf8'));
const ledger = JSON.parse(readFileSync(path.join(root, 'editorial/catalogue/ledger.json'), 'utf8'));
const config = JSON.parse(readFileSync(path.join(root, 'editorial/catalogue/config.json'), 'utf8'));

test('song slugs follow the published rule: official title, no featuring credit or apostrophes', () => {
  assert.equal(songSlug('She (Feat. MRCH)'), 'she');
  assert.equal(songSlug('Don’t feel sad'), 'dont-feel-sad');
  assert.equal(songSlug('Oh, Life [with Someone]'), 'oh-life');
  assert.equal(slugify('Car, the garden'), 'car-the-garden');
  for (const t of source().tracks.filter(t => !['esegye','whiteusedsocks','sunwoojunga','black-skirts','car-the-garden','choi-yu-ree','bol4','se-so-neon','motte','kim-sawol','yerin-baek','gongwon','yebit','yoon-mirae','baek-a-amor','hanroro','ydbb'].includes(t.id))) assert.equal(songSlug(t.track), t.slug, t.id);
  assert.deepEqual(appleIds('https://music.apple.com/us/album/oh-life-ep/1896168712?i=6766028347'), {album:'1896168712', song:'6766028347'});
  assert.deepEqual(appleIds('https://music.apple.com/us/song/surrender/1'), {song:'1'});
});

const lens = (name, candidates) => ({lens:name, candidates});
const cand = (name, korean, signals = [], extra = {}) => ({name, korean, category:'bands', genres:['Rock'], scope:'band-scene', signals, tracks:[{title:'Song', korean:'', reason:'chart'}], officialURL:'', ...extra});
const sig = (type, url, linkedArtistId = '') => ({type, url, publisher:'P', detail:'D', linkedArtistId});

test('lens results merge by English or Korean name, skip existing artists and never double-count a page', () => {
  const catalogue = createCatalogue(source());
  const merged = mergeCandidates([
    lens('band-scene', [cand('Silica Gel', '실리카겔', [sig('scene','https://a.example/1','se-so-neon'), sig('community','https://r.example/1')]), cand('HANRORO', '한로로', [sig('chart','https://c.example')])]),
    lens('recognition', [cand('SILICAGEL', '실리카겔', [sig('recognition','https://kma.example/1'), sig('community','https://r.example/1'), sig('scene','https://x.example','not-an-artist')])]),
  ], catalogue);
  assert.deepEqual(merged.map(c => c.id), ['silica-gel']);
  const [c] = merged;
  assert.deepEqual(c.lenses, ['band-scene','recognition']);
  assert.deepEqual(c.aliases, ['SILICAGEL']);
  assert.equal(c.signals.filter(s => s.url === 'https://r.example/1').length, 1);
  assert.equal(c.signals.find(s => s.url === 'https://a.example/1').linkedArtistId, 'se-so-neon');
  assert.equal(c.signals.find(s => s.url === 'https://x.example').linkedArtistId, undefined, 'unknown catalogue IDs are dropped');
  // An existing candidate keeps its status and ID when the lenses run again.
  const again = mergeCandidates([lens('band-scene', [cand('Silica Gel', '실리카겔')])], catalogue, [{...c, status:'approved', batch:'b1'}]);
  assert.equal(again[0].status, 'approved');
  assert.equal(again.length, 1);
});

test('scores are explainable components; candidates with blockers sort last', () => {
  const weights = {streaming:0.5, community:0.5};
  const base = {aliases:[], scopes:['indie'], tracks:[], signals:[]};
  const ranked = scoreCandidates([
    {...base, id:'a', name:'A', deezer:{id:1, fans:100}, apple:{url:'https://music.apple.com/us/artist/a/1'}},
    {...base, id:'b', name:'B', deezer:{id:2, fans:10000}, apple:{url:'https://music.apple.com/us/artist/b/2'}, signals:[sig('community','https://1'), sig('community','https://2')]},
    {...base, id:'c', name:'C', deezer:{id:3, fans:1000000}},
  ], {weights});
  assert.deepEqual(ranked.map(c => c.id), ['b','a','c']);
  assert.equal(ranked[0].components.community, 0.5);
  assert.deepEqual(ranked[2].blockers, ['no English Apple Music artist page found']);
  assert.ok(ranked[0].score > ranked[1].score && ranked[0].score <= 100);
});

test('Search Console exports are parsed in English or Korean and matched by artist names', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'indiek-sc-'));
  try {
    writeFileSync(path.join(dir, 'q.csv'), 'Top queries,Clicks,Impressions,CTR,Position\nsilica gel meaning,1,30,3%,4\n"korean indie, music",0,43,0%,9\n');
    writeFileSync(path.join(dir, 'k.csv'), '인기 검색어,클릭수,노출\n실리카겔 노 페인,0,5\n');
    const rows = [...parseSearchConsoleCSV(path.join(dir, 'q.csv')), ...parseSearchConsoleCSV(path.join(dir, 'k.csv'))];
    assert.deepEqual(rows[1], {query:'korean indie, music', clicks:0, impressions:43});
    assert.deepEqual(searchDemand({name:'Silica Gel', korean:'실리카겔', aliases:[]}, rows), {queries:['silica gel meaning','실리카겔 노 페인'], impressions:35, clicks:1});
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

// A complete, checkable fixture: one new band with a grade A primary song and a grade B song.
const release = (title, n) => ({ok:true, trackName:title, artistName:'Fixture Band', collectionName:`${title} - Single`, collectionURL:`https://music.apple.com/us/album/${songSlug(title)}-single/10${n}`, releaseDate:'2024-05-0'+n, durationSeconds:200, artwork:`https://is1-ssl.mzstatic.com/image/thumb/${n}/1200x1200bb.jpg`, checkedAt:'2026-11-10T00:00:00Z'});
const video = (id, channel, videoType = 'live') => ({playing:true, state:'playing', videoId:id, duration:215, advancedSeconds:3.5, checkedAt:'2026-11-10T00:00:00Z', method:'test', channel, videoType, official:'label channel', tried:[]});
const dossier = () => ({
  artist:{name:'Fixture Band', korean:'픽스처밴드', aliases:[], category:'bands', profileSources:[], facts:[]},
  tracks:[
    {role:'primary', title:'First Light', korean:'첫 빛', appleMusicURL:'https://music.apple.com/us/album/first-light-single/101?i=1', releaseTitle:'First Light', releaseDate:'2024-05-01', credits:'작사 A', creditsSource:{url:'https://label.example/first',label:'Label',language:'Korean'}, lyricSource:{url:'https://lyrics.example/first',label:'Bugs',language:'Korean'}, backgroundSources:[], facts:[], lyricObservations:[], youtube:[{videoId:'AAAAAAAAAAA',title:'',channel:'',channelURL:'',videoType:'live',official:'x'},{videoId:'BBBBBBBBBBB',title:'',channel:'',channelURL:'',videoType:'live',official:'x'}], featuredArtists:['HANRORO'], uncertainties:[]},
    {role:'additional', title:'Second Road', korean:'', appleMusicURL:'https://music.apple.com/us/album/second-road-single/102?i=2', releaseTitle:'Second Road', releaseDate:'2024-05-02', credits:'', creditsSource:{url:'https://label.example/second',label:'Label',language:'Korean'}, lyricSource:{url:'',label:'',language:''}, backgroundSources:[], facts:[], lyricObservations:[], youtube:[{videoId:'CCCCCCCCCCC',title:'',channel:'',channelURL:'',videoType:'music-video',official:'Topic'}], featuredArtists:[], uncertainties:[]},
  ],
  uncertainties:[],
});
const src = (url, label = 'Label — release notes') => ({url, label, language:'Korean'});
const draft = (overrides = {}) => ({
  artist:{artistIntro:'Fixture Band is a four-piece that writes about commuting and night shifts.', biography:'The band released its first single in 2024.', artistSource:'https://label.example/band', artistSourceName:'Label — Fixture Band profile', artistSourceLanguage:'Korean', aliases:'픽스처 Fixture', category:'bands'},
  tracks:[
    {key:'t1', genre:'indie rock', note:'A song about the first train of the day.', description:'“First Light” follows a commute before sunrise. The band wrote it after a year of early shifts.', listeningNote:'The label describes the single as the band’s first release.', credits:'Lyrics and music by Fixture Band.', extraSources:[src('https://label.example/first')], guideTags:['guitars-and-bands'],
      lyricNotes:{heading:'Before the sun', themes:['Commuting'], paragraphs:['The song starts on an empty platform and counts the stations.', 'By the end the speaker notices the light without making it a promise.'], source:src('https://lyrics.example/first','Bugs — lyrics'), backgroundSources:[]}, ...overrides.t1},
    {key:'t2', genre:'INDIE ROCK', note:'A road song from the same year.', description:'“Second Road” is the band’s second single, written about leaving a rehearsal room.', listeningNote:'It followed the first single within a day, according to the label.', credits:'Lyrics and music by Fixture Band.', extraSources:[src('https://label.example/second')], guideTags:['guitars-and-bands'],
      lyricNotes:{heading:'', themes:[], paragraphs:[], source:{url:'',label:'',language:''}, backgroundSources:[]}, ...overrides.t2},
  ],
});
const unitFor = () => ({artistId:'fixture-band', candidateId:'fixture-band', existing:false, count:2, knownTitles:[], candidate:{name:'Fixture Band', korean:'픽스처밴드', aliases:[]}, deezerId:null});
const assembled = (d = draft()) => {
  const unit = unitFor();
  unit.tracks = [{key:'t1', index:0, role:'primary', grade:'A'}, {key:'t2', index:1, role:'additional', grade:'B'}];
  return {unit, entries:assembleEntries({unit, dossier:dossier(), draft:d, releases:{t1:release('First Light', 1), t2:release('Second Road', 2)}, videos:{t1:video('AAAAAAAAAAA','Label Live'), t2:video('CCCCCCCCCCC','Fixture Band - Topic','music-video')}, existingArtists:source().artists, day:'2026-11-10'})};
};

test('identity, release and recording fields come from checked data, not from the draft', () => {
  const {entries} = assembled();
  const [a, b] = entries.tracks.map(t => t.entry);
  assert.equal(entries.artist.primaryTrackId, 'fixture-band-first-light');
  assert.deepEqual(entries.artist.editorial, {author:'indiek', updated:'2026-11-10'});
  assert.equal(a.slug, 'first-light');
  assert.equal(a.release, 'First Light — Single');
  assert.equal(a.source, 'https://music.apple.com/us/album/first-light-single/101');
  assert.equal(a.duration, '03:35');
  assert.equal(a.genre, 'INDIE ROCK');
  assert.deepEqual(a.featuredArtistIds, ['hanroro']);
  assert.equal(a.koreanTitle, '첫 빛');
  assert.equal(b.videoType, 'audio', 'a Topic channel is always official audio');
  assert.equal(b.lyricNotes, undefined, 'grade B drops empty lyric notes');
  assert.ok(a.lyricNotes.paragraphs.length === 2);
  assert.deepEqual(gradeMissing(a, 'A'), []);
  assert.deepEqual(gradeMissing(b, 'B'), []);
  assert.deepEqual(citedSources(entries).sort(), ['https://label.example/band','https://label.example/first','https://label.example/second','https://lyrics.example/first']);
});

test('lint passes a clean draft and catches invented experience, stock praise, long lyric quotes and missing grade fields', () => {
  const {unit, entries} = assembled();
  assert.deepEqual(lintEntries(entries, {source:source(), unit}), []);
  const bad = assembled(draft({
    t1:{description:'I first heard this on a night bus and it is a hidden gem.', lyricNotes:{...draft().tracks[0].lyricNotes, paragraphs:['그대가 내게 오던 그날 밤 나는 아무 말도 하지 못하고 서 있었지', 'Second paragraph.']}},
    t2:{credits:'', guideTags:[]},
  }));
  const issues = lintEntries(bad.entries, {source:source(), unit:bad.unit}).join('\n');
  assert.match(issues, /t1\.description: first-person voice/);
  assert.match(issues, /hidden gem/);
  assert.match(issues, /Korean quotation longer than a short phrase/);
  assert.match(issues, /grade B needs credits/);
  assert.match(issues, /needs a guide tag/);
});

function fakeDeps({facts = 'approve', editorial = 'approve', playable = new Set(['AAAAAAAAAAA','BBBBBBBBBBB','CCCCCCCCCCC']), channels = {AAAAAAAAAAA:'KDRAMA CLIPS', BBBBBBBBBBB:'Fixture Band 픽스처밴드', CCCCCCCCCCC:'Fixture Band - Topic'}, unreadable = []} = {}) {
  const calls = [];
  const pages = {'https://label.example/band':'Fixture Band was formed in 2023.', 'https://label.example/first':'First Light credits: lyrics by Fixture Band', 'https://label.example/second':'Second Road credits list', 'https://lyrics.example/first':'첫 빛 가사 전체 empty platform'};
  const claims = Object.entries(pages).map(([url, body]) => ({claim:'c', sourceURL:url, evidence:body.slice(0, 20)}));
  const ask = async (stage, prompt) => {
    calls.push(stage);
    if (stage === 'research') return dossier();
    if (stage === 'draft') return draft();
    if (stage === 'facts') return facts === 'approve' ? {approved:true, reason:'All supported', issues:[], checkedURLs:Object.keys(pages), supportedClaims:claims} : {approved:false, reason:'No', issues:['Debut year unsupported'], checkedURLs:[], supportedClaims:[]};
    if (stage === 'review') return editorial === 'approve' ? {approved:true, reason:'Specific and measured', issues:[], invented:[], gradeChecks:[{key:'t1',grade:'A',meets:true,missing:[]},{key:'t2',grade:'B',meets:true,missing:[]}]} : {approved:false, reason:'No', issues:['description: generic'], invented:[], gradeChecks:[]};
    throw new Error(stage);
  };
  return {calls, deps:{root, ask, top:async () => [], images:new Map(), request:async url => ({body:pages[url]}),
    pages:async urls => Object.fromEntries(urls.map(url => [url, pages[url] && !unreadable.includes(url) ? {ok:true, text:pages[url]} : {ok:false, reason:'HTTP 403'}])),
    release:async ({title}) => release(title, title === 'First Light' ? 1 : 2),
    oembed:async id => ({channel:channels[id], channelURL:`https://www.youtube.com/@${id}`, title:`${id} (Live)`}),
    playback:async ([id]) => ({[id]:playable.has(id) ? video(id, '') : {videoId:id, state:'error', playing:false, code:150, error:'embedding disabled by the owner'}})}};
}
const run = async options => {
  const {calls, deps} = fakeDeps(options);
  const state = {artistId:'fixture-band'};
  let saves = 0;
  const result = await prepareUnit({unit:unitFor(), state, save:() => saves++, config:{...config, maxVersionsPerTrack:2}, deps, source:source(), catalogue:source(), skill:'skill', revision:'rev', searchRows:[], deadline:Date.now() + 60000});
  return {result, calls, saves};
};

test('a unit is approved only after research, real playback, lint and both independent reviews', async () => {
  const {result, calls, saves} = await run();
  assert.equal(result.status, 'approved');
  assert.deepEqual(calls, ['research','draft','facts','review']);
  assert.ok(saves >= 5, 'state is saved between steps');
  const t1 = result.approved.entries.tracks.find(t => t.key === 't1');
  assert.equal(t1.entry.videoId, 'BBBBBBBBBBB', 'an upload on an unconfirmed channel is skipped for the artist’s own channel');
  assert.deepEqual(result.videos.t1.tried.map(t => t.state), ['channel not confirmed as official','playing']);
  assert.equal(result.videos.t1.official, 'the artist’s own channel');
  assert.ok(Object.values(result.pages).every(p => p.ok && !('text' in p)), 'page text is never saved in state');
  assert.equal(result.approved.review.hashes[t1.entry.id], entryHash(result.approved.entries.artist, t1.entry));
  assert.equal(result.approved.review.playback[t1.entry.id].videoId, 'BBBBBBBBBBB');
});

test('rejections are recorded, consume the version budget and send fact failures back to research', async () => {
  const facts = await run({facts:'reject'});
  assert.equal(facts.result.status, 'exhausted');
  assert.deepEqual(facts.calls, ['research','draft','facts','review','research','draft','facts','review']);
  assert.match(facts.result.attempts[0].reason, /Debut year unsupported/);
  const editorial = await run({editorial:'reject'});
  assert.deepEqual(editorial.calls, ['research','draft','facts','review','draft','facts','review'], 'an editorial rejection redrafts without new research');
  const unread = await run({unreadable:['https://label.example/second']});
  assert.ok(!unread.calls.includes('facts'), 'no review is spent on a draft citing a page the evidence check cannot read');
  assert.match(unread.result.attempts[0].reason, /Cited page cannot be fetched for verification \(HTTP 403\): https:\/\/label.example\/second/);
  const blocked = await run({playable:new Set(['AAAAAAAAAAA','CCCCCCCCCCC'])});
  assert.equal(blocked.result.status, 'exhausted');
  assert.ok(!blocked.calls.includes('draft'), 'no draft is written when the primary song has no playable recording');
  assert.match(blocked.result.attempts[0].reason, /Primary song failed deterministic checks/);
});

test('official channels are decided from oEmbed data: own channel, Topic or a listed label, never a look-alike', () => {
  const names = ['Say Sue Me', '세이수미'];
  const listed = [{channelURL:'https://www.youtube.com/@1theK', kind:'distributor', basis:'catalogue'}];
  assert.equal(officialBasis({channel:'Say Sue Me 세이수미', channelURL:'https://www.youtube.com/@x'}, names), 'the artist’s own channel');
  assert.equal(officialBasis({channel:'Say Sue Me - Topic', channelURL:'https://www.youtube.com/channel/UC1'}, names), 'the artist’s YouTube Topic channel (official audio)');
  assert.match(officialBasis({channel:'1theK (원더케이)', channelURL:'https://www.youtube.com/@1theK'}, names, listed), /^distributor channel/);
  for (const channel of ['KDRAMAHOLIC. ID', 'Say Sue Me Fans', 'say sue me lyrics', 'Other Band - Topic', '1theK (원더케이)']) assert.equal(officialBasis({channel, channelURL:'https://www.youtube.com/@fake'}, names, listed), null, channel);
});

test('a declared live or lyric-video format must show in the title or come from a live-series channel', () => {
  const listed = [{channelURL:'https://www.youtube.com/@official.onstage', kind:'live-series'}];
  assert.ok(formatConfirmed('live', {title:'Say Sue Me - My Heart (Live at SSM’s HQ)'}));
  assert.ok(formatConfirmed('live', {title:'카더가든 나무 | 비긴어게인 오픈마이크'}));
  assert.ok(formatConfirmed('live', {title:'[온스테이지2.0] 유라 - 깜빡', channelURL:'https://www.youtube.com/@official.onstage'}, listed));
  assert.equal(formatConfirmed('live', {title:'moneto - She (feat. MRCH)', channelURL:'https://www.youtube.com/@x'}, listed), false);
  assert.ok(formatConfirmed('lyric-video', {title:'0310 (Official Lyric Video)'}));
  assert.equal(formatConfirmed('lyric-video', {title:'0310 (Official Video)'}), false);
  assert.ok(formatConfirmed('music-video', {title:'Anything'}));
});

test('approval requires both reviews, every grade and evidence for each cited page', () => {
  const {entries} = assembled();
  const facts = {approved:true, reason:'ok', issues:[], checkedURLs:[], supportedClaims:[]};
  const editorial = {approved:true, reason:'ok', issues:[], invented:[], gradeChecks:[{key:'t1', grade:'A', meets:true, missing:[]}]};
  assert.ok(approval({facts, editorial, entries, revision:'r', playback:{}}));
  assert.equal(approval({facts, editorial:{...editorial, invented:['description claims a memory']}, entries, revision:'r', playback:{}}), null);
  assert.equal(approval({facts, editorial:{...editorial, gradeChecks:[{key:'t1', grade:'A', meets:false, missing:['lyric notes']}]}, entries, revision:'r', playback:{}}), null);
});

test('human review samples are reproducible and never empty', () => {
  const ids = Array.from({length:13}, (_, i) => `t${i}`);
  assert.equal(humanSample(ids, 0.15).size, 2);
  assert.deepEqual([...humanSample(ids, 0.15)], [...humanSample([...ids].reverse(), 0.15)]);
  assert.equal(humanSample(['only'], 0.15).size, 1);
  const rights = rightsEntry({file:'x.jpg', artist:'A', release:release('First Light', 1), day:'2026-11-10'});
  assert.equal(rights.status, 'unconfirmed');
  assert.equal(rights.credit, 'Apple Music release artwork');
});

// The ledger is what lets dozens of songs a week skip hand checks: each pipeline song must still be
// exactly what was reviewed, with a recording that played and every cited page checked.
test('pipeline songs match their reviewed content, sources, release and playback records', () => {
  const data = source();
  const rights = JSON.parse(readFileSync(path.join(root, 'content/image-rights.json'), 'utf8')).images;
  const catalogue = createCatalogue(structuredClone(data));
  for (const [id, record] of Object.entries(ledger.tracks)) {
    const track = data.tracks.find(t => t.id === id);
    assert.ok(track, `Ledger song missing from the catalogue: ${id}`);
    const artist = data.artists.find(a => a.id === track.artistId);
    assert.equal(record.artistId, track.artistId, id);
    assert.equal(entryHash(ledger.artists[track.artistId] ? artist : null, track), record.contentHash, `${id} changed after its review; run npm run catalogue -- review ${id}`);
    assert.ok(['A','B'].includes(record.grade), id);
    assert.deepEqual(gradeMissing(track, record.grade), [], `${id} no longer meets grade ${record.grade}`);
    if (record.grade === 'A') assert.ok(songPageStatus([...catalogue.records, catalogue.editorPick].find(t => t.id === id)).ready, `${id}: grade A song page must be indexable`);
    assert.equal(record.playback.videoId, track.videoId, `${id}: recording changed after the playback check`);
    assert.equal(record.playback.state, 'playing', id);
    assert.ok(record.facts.approved && record.editorial.approved && record.skillRevision, id);
    for (const url of record.sources) assert.ok(record.facts.checkedURLs.includes(url), `${id}: cited page was not opened by the fact review: ${url}`);
    for (const url of record.sources) assert.ok(record.facts.supportedClaims.some(c => c.sourceURL === url), `${id}: no claim-level evidence from ${url}`);
    assert.equal(record.release.appleMusic, track.source, id);
    const image = rights.find(i => i.file === track.image);
    assert.ok(image?.source && image.credit && image.checked, `${id}: release artwork needs a rights record with its source`);
    if (record.humanSample) assert.ok(['pending','approved','changes-requested'].includes(record.humanReview?.status), id);
  }
  for (const id of Object.keys(ledger.artists)) assert.ok(data.artists.some(a => a.id === id), `Ledger artist missing: ${id}`);
});

test('a new grade B artist builds through every public output and the page checker', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'indiek-pipeline-build-'));
  try {
    for (const folder of ['scripts','site','content','.openai']) cpSync(path.join(root, folder), path.join(dir, folder), {recursive:true});
    mkdirSync(path.join(dir, 'dist'));
    cpSync(path.join(root, 'dist/assets'), path.join(dir, 'dist/assets'), {recursive:true});
    cpSync(path.join(root, 'dist/favicon.svg'), path.join(dir, 'dist/favicon.svg'));
    copyFileSync(path.join(root, 'dist/assets/hanroro-even-if-you-leave.jpg'), path.join(dir, 'dist/assets/fixture-band-second-road.jpg'));
    const data = source();
    const {entries} = assembled();
    const b = {...entries.tracks[1].entry, image:'fixture-band-second-road.jpg', videoId:'QRwfXQ7-OR4', url:'https://www.youtube.com/watch?v=QRwfXQ7-OR4'};
    data.artists.push({...entries.artist, primaryTrackId:b.id});
    data.tracks.push(b);
    const rights = JSON.parse(readFileSync(path.join(dir, 'content/image-rights.json'), 'utf8'));
    rights.images.push(rightsEntry({file:b.image, artist:'Fixture Band', release:release('Second Road', 2), day:'2026-11-10'}));
    writeFileSync(path.join(dir, 'content/image-rights.json'), JSON.stringify(rights));
    const write = value => writeFileSync(path.join(dir, 'content/catalogue.json'), JSON.stringify(value));
    write(data);
    execFileSync('python3', ['scripts/prepare-images.py'], {cwd:dir, stdio:'pipe'});
    execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:dir, stdio:'pipe'});
    execFileSync('python3', ['scripts/check.py'], {cwd:dir, stdio:'pipe'});
    const song = readFileSync(path.join(dir, 'dist/artists/fixture-band/second-road/index.html'), 'utf8');
    assert.match(song, /<meta name="robots" content="noindex">/, 'grade B song pages stay out of search until lyric notes exist');
    assert.ok(song.includes('Lyrics and music by Fixture Band.'));
    const artistPage = readFileSync(path.join(dir, 'dist/artists/fixture-band/index.html'), 'utf8');
    assert.ok(artistPage.includes('data-load-player="fixture-band-second-road"'));
    const guide = readFileSync(path.join(dir, 'dist/notes/korean-indie-where-to-start/index.html'), 'utf8');
    assert.ok(guide.includes('data-guide-more="fixture-band-second-road"'), 'the introductory guide adds the new artist automatically');
    // Removing a grade B detail must fail the page checker, not quietly ship a thin page.
    delete b.credits;
    write(data);
    execFileSync(process.execPath, ['scripts/build.mjs'], {cwd:dir, stdio:'pipe'});
    assert.throws(() => execFileSync('python3', ['scripts/check.py'], {cwd:dir, stdio:'pipe'}), /Missing lyric commentary or grade B details: fixture-band-second-road/);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});
