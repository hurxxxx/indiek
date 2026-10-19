import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getListeningGuides} from '../site/shared.mjs';
import {publishedEntries, feedXML, relatedRecords, shareImagePath} from '../site/editorial.mjs';
const catalogue=JSON.parse(readFileSync(new URL('../content/catalogue.json',import.meta.url)));
test('curated guide order is deliberate, drafts stay private, automatic coverage remains required',()=>{
  const c=structuredClone(catalogue), guides=getListeningGuides(c);
  const intro=guides.find(g=>g.id==='korean-indie-where-to-start');
  assert.deepEqual(intro.records.map(r=>r.id),intro.trackIds);
  assert.ok(!guides.some(g=>g.status==='draft'));
  c.records.find(r=>r.id==='hanroro').guideTags=[]; // Inclusion in an essay must not hide missing automatic classification.
  assert.throws(()=>getListeningGuides(c),/missing.*hanroro/);
  const invalid=structuredClone(catalogue);invalid.listeningGuides.find(g=>g.selection==='curated').trackIds[0]='missing';
  assert.throws(()=>getListeningGuides(invalid),/Missing curated track/);
});
test('RSS includes only genuinely dated publications, with stable IDs and escaped content',()=>{
  const entries=[{path:'/artists/a/',title:'A & B',description:'<music>',published:'2026-10-19'},{path:'/draft/',title:'Draft'},{path:'/future/',published:'2099-01-01'}];
  assert.equal(publishedEntries(entries,new Date('2026-10-20')).length,1);
  const xml=feedXML(catalogue.site,entries,new Date('2026-10-20'));
  assert.match(xml,/A &amp; B/);assert.match(xml,/&lt;music&gt;/);assert.ok(!xml.includes('/draft/'));assert.ok(!xml.includes('/future/'));
  assert.match(xml,/<guid isPermaLink="true">https:\/\/indiek.com\/artists\/a\//);
});
test('related recommendations never recommend the current artist or duplicate a track',()=>{
  const guides=getListeningGuides(catalogue);
  for(const artist of [...catalogue.records,catalogue.editorPick]){
    const related=relatedRecords(artist,guides);
    assert.equal(related.records.length,3);
    assert.equal(new Set(related.records.map(r=>r.id)).size,3);
    assert.ok(related.records.every(r=>r.id!==artist.id));
  }
  assert.equal(shareImagePath('/artists/yerin-baek/'),'/assets/social/artists-yerin-baek.jpg');
});
test('built feed, public catalogue and metadata exclude editorial drafts',()=>{
  const runtime=readFileSync(new URL('../dist/catalogue.js',import.meta.url),'utf8');
  for(const guide of catalogue.listeningGuides.filter(g=>g.status==='draft'))assert.ok(!runtime.includes(guide.id));
  const html=readFileSync(new URL('../dist/notes/korean-indie-where-to-start/index.html',import.meta.url),'utf8');
  assert.match(html,/application\/ld\+json/);
  const article=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const guide=catalogue.listeningGuides.find(g=>g.id==='korean-indie-where-to-start');
  assert.equal(article.datePublished,guide.editorial.published); // Use the recorded release date; preparation dates are not publication dates.
  assert.match(html,/data-share-page/);assert.match(html,/data-load-player="yerin-baek"/);
});
