import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchCatalogue, readSaved, getFeaturedArtists, formatPosition, getListeningGuides} from '../site/shared.mjs';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json',import.meta.url)));
const {records, editorPick} = catalogue;
const freshCatalogue = () => JSON.parse(JSON.stringify(catalogue));

test('listening guides cover every artist with the intended opening tracks and counts',()=>{
  const guides = getListeningGuides(catalogue);
  assert.deepEqual(guides.map(g=>[g.id,g.records.length,g.records[0].id]),[
    ['on-stage',6,'sunwoojunga'],['guitars-and-bands',6,'black-skirts'],['distinct-voices',10,'yoon-mirae'],
  ]);
  assert.deepEqual([...new Set(guides.flatMap(g=>g.records.map(r=>r.id)))].sort(),[...records,editorPick].map(r=>r.id).sort());
  for (const guide of guides) assert.equal(new Set(guide.records.map(r=>r.id)).size,guide.records.length);
  assert.ok(guides.find(g=>g.id==='on-stage').records.find(r=>r.id==='car-the-garden').externalOnly);
});
test('live membership follows video metadata when recordings are added or changed',()=>{
  const edited = freshCatalogue();
  edited.records.push({id:'new-live',videoType:'live',guideTags:[]});
  edited.records.find(r=>r.id==='car-the-garden').videoType='music-video';
  const ids=getListeningGuides(edited).find(g=>g.id==='on-stage').records.map(r=>r.id);
  assert.ok(ids.includes('new-live'));
  assert.ok(!ids.includes('car-the-garden'));
  assert.equal(ids[0],'sunwoojunga');
});
test('edited tags change membership without changing the artist catalogue order',()=>{
  const edited=freshCatalogue();
  edited.records.find(r=>r.id==='hanroro').guideTags=['distinct-voices'];
  edited.records.push({id:'new-guitar',guideTags:['guitars-and-bands','guitars-and-bands']});
  const ids=getListeningGuides(edited).find(g=>g.id==='guitars-and-bands').records.map(r=>r.id);
  assert.deepEqual(ids,['black-skirts','esegye','se-so-neon','ydbb','whiteusedsocks','new-guitar']);
});
test('unclassified artists and unknown tags cannot silently disappear from guides',()=>{
  const missing=freshCatalogue();
  missing.records.push({id:'new-unclassified',guideTags:[]});
  assert.throws(()=>getListeningGuides(missing),/missing.*new-unclassified/i);
  const unknown=freshCatalogue();
  unknown.editorPick.guideTags.push('typo');
  assert.throws(()=>getListeningGuides(unknown),/Unknown guide tag "typo" for yoon-mirae/);
});
test('invalid guide definitions fail before generating misleading pages',()=>{
  const invalidLead=freshCatalogue();
  invalidLead.listeningGuides[0].featuredArtistId='yoon-mirae';
  assert.throws(()=>getListeningGuides(invalidLead),/not included in on-stage/);
  const duplicates=freshCatalogue();
  duplicates.listeningGuides.push(duplicates.listeningGuides[0]);
  assert.throws(()=>getListeningGuides(duplicates),/Duplicate listening guide ID/);
  const badSelection=freshCatalogue();
  badSelection.listeningGuides[0].selection='typo';
  assert.throws(()=>getListeningGuides(badSelection),/Invalid selection/);
});
for(const [query,expected] of [
  ['볼빨간 사춘기','bol4'],['사랑할수밖에','bol4'],['Sunwoo Jung A','sunwoojunga'],
  ['Sunwoo Jung-a','sunwoojunga'],['Car the garden','car-the-garden'],['최 유리','choi-yu-ree'],
  ['윤미래','yoon-mirae'],['Yoon Mi Rae','yoon-mirae'],['Don’t feel sad','whiteusedsocks'],
  ["Don't feel sad",'whiteusedsocks'],['Romance Youth Love','esegye'],['  ＢＯＬ４  ','bol4'],
]) {
  test(`search finds ${query}`,()=>{
    assert.deepEqual(searchCatalogue(records,editorPick,query).map(r=>r.id),[expected]);
  });
}
test('empty search includes all shelf entries and the editor pick',()=>{
  assert.equal(searchCatalogue(records,editorPick,'').length,records.length+1);
  assert.deepEqual(searchCatalogue(records,editorPick,'not-a-real-artist-983'),[]);
});
test('existing ONCE save survives migration and unknown IDs do not appear',()=>{
  assert.deepEqual([...readSaved('["ydbb","unknown","ydbb"]',records)],['ydbb']);
});
test('missing, corrupt and non-array browser storage are harmless',()=>{
  for(const value of [null,'{','{}','null','42'])assert.equal(readSaved(value,records).size,0);
});
test('hero includes each artist and the editor pick, preserving the editorial opening order',()=>{
  const features = getFeaturedArtists(catalogue);
  assert.deepEqual(features.slice(0,4).map(f=>f.id),['ydbb','whiteusedsocks','motte','hanroro']);
  assert.deepEqual(features.map(f=>f.id).sort(),[...records,editorPick].map(r=>r.id).sort());
  assert.equal(features.find(f=>f.id==='yoon-mirae').kind,'artwork');
});
test('a newly added artist enters the hero automatically without a separate feature entry',()=>{
  const record = {id:'new-artist',artist:'New Artist',track:'First Song',image:'new.jpg',release:'First Release',note:'A first listen.'};
  const features = getFeaturedArtists({...catalogue,records:[...records,record]});
  const added = features.filter(f=>f.id===record.id);
  assert.equal(added.length,1);
  assert.equal(added[0].image,record.image);
  assert.equal(added[0].kind,'artwork');
  assert.equal(formatPosition(features.length),String(records.length+2).padStart(2,'0'));
  assert.equal(formatPosition(1),'01');
});
