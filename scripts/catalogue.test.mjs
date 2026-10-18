import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchCatalogue, readSaved, getFeaturedArtists, formatPosition} from '../site/shared.mjs';

const catalogue = JSON.parse(readFileSync(new URL('../content/catalogue.json',import.meta.url)));
const {records, editorPick} = catalogue;
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
test('empty search includes all eleven shelf entries and the editor pick',()=>{
  assert.equal(searchCatalogue(records,editorPick,'').length,12);
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
  assert.equal(formatPosition(features.length),'13');
  assert.equal(formatPosition(1),'01');
});
