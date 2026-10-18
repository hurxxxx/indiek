import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {searchCatalogue, readSaved} from '../site/shared.mjs';

const {records, editorPick} = JSON.parse(readFileSync(new URL('../content/catalogue.json',import.meta.url)));
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
