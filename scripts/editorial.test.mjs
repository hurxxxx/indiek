import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getListeningGuides} from '../site/shared.mjs';
import {publishedEntries, feedXML, relatedRecords, shareImagePath, homeUpdates} from '../site/editorial.mjs';
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
test('the introductory guide includes new artists without expanding or duplicating its opening selection',()=>{
  const c=structuredClone(catalogue);
  c.records.push({...c.records[0],id:'new-artist'});
  const intro=getListeningGuides(c).find(g=>g.id==='korean-indie-where-to-start');
  assert.deepEqual(intro.records.map(r=>r.id),intro.trackIds);
  assert.ok(intro.moreRecords.some(r=>r.id==='new-artist'));
  assert.ok(intro.moreRecords.some(r=>r.id===c.editorPick.id));
  const ids=[...intro.records,...intro.moreRecords].map(r=>r.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual(ids.sort(),[...c.records,c.editorPick].map(r=>r.id).sort());
});
test('introductory listening notes cannot silently link to a removed or missing next artist',()=>{
  const c=structuredClone(catalogue);
  const intro=c.listeningGuides.find(g=>g.id==='korean-indie-where-to-start');
  intro.trackDetails[intro.trackIds[0]].nextArtistId='removed-artist';
  assert.throws(()=>getListeningGuides(c),/Missing listening detail or next artist/);
  delete intro.trackDetails[intro.trackIds[0]];
  assert.throws(()=>getListeningGuides(c),/Missing listening detail or next artist/);
});
test('RSS includes only genuinely dated publications, with stable IDs and escaped content',()=>{
  const entries=[{path:'/artists/a/',title:'A & B',description:'<music>',published:'2026-10-19'},{path:'/draft/',title:'Draft'},{path:'/future/',published:'2099-01-01'}];
  assert.equal(publishedEntries(entries,new Date('2026-10-20')).length,1);
  const xml=feedXML(catalogue.site,entries,new Date('2026-10-20'));
  assert.match(xml,/A &amp; B/);assert.match(xml,/&lt;music&gt;/);assert.ok(!xml.includes('/draft/'));assert.ok(!xml.includes('/future/'));
  assert.match(xml,/<guid isPermaLink="true">https:\/\/indiek.com\/artists\/a\//);
});
test('home previews can announce ready additions without inventing publication dates or adding them to RSS',()=>{
  const entries=[{id:'a',path:'/artists/a/',type:'Artist',title:'A',description:'New artist.'}];
  const updates=[{id:'a-introduction',status:'ready',kind:'artist',path:'/artists/a/',title:'A',description:'A song and lyric notes.'}];
  const now=new Date('2026-10-21T12:00:00+09:00');
  const live=homeUpdates(entries,updates,{now});
  assert.equal(live.length,0);
  const preview=homeUpdates(entries,updates,{now,preview:true});
  assert.deepEqual(preview.map(item=>item.id),['a-introduction']);
  assert.ok(!preview[0].date&&!preview[0].published);
  assert.ok(!feedXML(catalogue.site,entries,now).includes('/artists/a/'));
});
test('a meaningful update replaces its original listing; ordinary edits do not change home order',()=>{
  const entries=[
    {id:'a',path:'/artists/a/',title:'A',description:'Artist',type:'Artist',published:'2026-10-19',updated:'2026-10-23'},
    {id:'story',path:'/stories/story/',title:'Story',description:'Story',type:'Story',published:'2026-10-20'},
    {id:'guide',path:'/notes/guide/',title:'Guide',description:'Guide',type:'Guide',published:'2026-10-21'},
  ];
  const now=new Date('2026-10-24');
  assert.deepEqual(homeUpdates(entries,[],{now}).map(item=>item.id),['guide','story','a']);
  const updates=[{id:'a-lyrics',status:'published',kind:'lyrics',path:'/artists/a/#lyrics',title:'A: inside the lyrics',description:'A new explanation.',published:'2026-10-22'}];
  const result=homeUpdates(entries,updates,{now,excludePaths:['/stories/story/']});
  assert.deepEqual(result.map(item=>item.id),['a-lyrics','guide']);
  assert.equal(result[0].path,'/artists/a/#lyrics');
  assert.equal(entries[0].published,'2026-10-19');
});
test('home updates exclude drafts and future announcements even in preview, and reject broken publication data',()=>{
  const entries=[{id:'a',path:'/artists/a/',type:'Artist',published:'2026-10-19'}];
  const update={id:'a-live',status:'published',kind:'live',path:'/artists/a/#live',title:'A live',description:'A live session.',published:'2026-10-22'};
  const options={now:new Date('2026-10-21T12:00:00+09:00'),preview:true};
  assert.deepEqual(homeUpdates(entries,[update,{id:'draft',status:'draft'}],options).map(item=>item.id),['a']);
  for(const patch of [{published:'2026-02-30'},{published:'2026-10-18'},{path:'/artists/missing/'},{status:'ready'},{kind:'unknown'}]){
    assert.throws(()=>homeUpdates(entries,[{...update,...patch}],options),/home update/i);
  }
  assert.throws(()=>homeUpdates(entries,[update,update],options),/duplicate home update ID/);
  assert.throws(()=>homeUpdates([{...entries[0],published:undefined}],[{...update,kind:'artist'}],options),/actual page and update publication dates/);
  const legacy=[{...entries[0],published:undefined}];
  const liveAddition={...update,published:'2026-10-21'};
  assert.equal(homeUpdates(legacy,[liveAddition],options)[0].id,'a-live');
  assert.equal(legacy[0].published,undefined); // Announcing a new session must not require a made-up first publication date.
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
  const opening=[...html.matchAll(/data-guide-track="([^"]+)"/g)].map(match=>match[1]);
  const more=[...html.matchAll(/data-guide-more="([^"]+)"/g)].map(match=>match[1]);
  const playable=[...html.matchAll(/data-load-player="([^"]+)"/g)].map(match=>match[1]);
  const all=[...catalogue.records,catalogue.editorPick].map(r=>r.id).sort();
  assert.deepEqual(opening,guide.trackIds);
  assert.deepEqual([...opening,...more].sort(),all);
  assert.deepEqual(playable.sort(),all);
  assert.ok(!html.includes(`data-save="${catalogue.editorPick.id}"`));
});
test('guide headers, cards and publishing data count follow-on artists without changing the curated order',()=>{
  const publicItems=JSON.parse(readFileSync(new URL('../dist/promotion-catalogue.json',import.meta.url))).items;
  const indexes=['index.html','notes/first-listens/index.html'].map(path=>readFileSync(new URL(`../dist/${path}`,import.meta.url),'utf8'));
  for(const guide of getListeningGuides(catalogue)){
    const members=[...guide.records,...(guide.moreRecords||[])];
    const html=readFileSync(new URL(`../dist/notes/${guide.id}/index.html`,import.meta.url),'utf8');
    assert.ok(html.includes(`LISTENING GUIDE / ${members.length} TRACKS`));
    for(const index of indexes){
      const card=index.match(new RegExp(`<article class="guide-card" data-guide="${guide.id}"[\\s\\S]*?</article>`))?.[0];
      assert.ok(card?.includes(`data-track-count="${members.length}"`));
      assert.ok(card.includes(`<span>${members.length} TRACKS</span>`));
      if(members.length>3)assert.ok(card.includes(`+ ${members.length-3} more`));
    }
    assert.deepEqual(publicItems.find(item=>item.id===guide.id).artistIds,members.map(r=>r.id));
    if(guide.selection==='curated')assert.deepEqual(guide.records.map(r=>r.id),guide.trackIds);
  }
});
