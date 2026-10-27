import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,cpSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadCatalogue} from './catalogue.mjs';
import {resolveHome} from './home.mjs';
import {getArtistRecords,getFeaturedArtists,getListeningGuides,readSaved} from '../site/shared.mjs';

const root = fileURLToPath(new URL('../',import.meta.url));
const read = name => JSON.parse(readFileSync(path.join(root,'content',name),'utf8'));
// Unit fixtures use their own story list, independent of the production editorial pin.
const source = () => { const data=read('home.json'); data.sections.find(s=>s.type==='story').storyId=null; return data; };
const catalogue = loadCatalogue(root);
const context = {catalogue,media:read('media.json'),rights:read('image-rights.json'),stories:[
  {id:'older',slug:'older',status:'published',published:'2025-01-01'},
  {id:'latest',slug:'latest',status:'published',published:'2025-02-01'},
  {id:'draft',slug:'draft',status:'draft',published:'2025-03-01'},
  {id:'future',slug:'future',status:'published',published:'2999-01-01'},
]};
const section = (home,type) => home.sections.find(s=>s.type===type);

test('home preferences reorder complete collections without changing the catalogue or Saved',()=>{
  const data=source(), snapshot=JSON.stringify(context);
  section(data,'discover').features.unshift({id:'gongwon',title:'Home only'});
  section(data,'discover').trackOrder=['yoon-mirae','gongwon'];
  section(data,'guides').guideOrder=[getListeningGuides(catalogue).at(-1).id];
  section(data,'pick').trackId='black-skirts';
  const home=resolveHome(data,context);
  const discover=section(home,'discover');
  assert.equal(discover.features[0].id,'gongwon');
  assert.equal(discover.features[0].title,'Home only');
  assert.deepEqual(discover.features.map(f=>f.id).sort(),getArtistRecords(catalogue).map(r=>r.artistId).sort());
  assert.deepEqual(discover.tracks.slice(0,2).map(t=>t.id),['yoon-mirae','gongwon']);
  assert.equal(discover.tracks.length,catalogue.records.length+1);
  assert.equal(section(home,'guides').guides[0].id,section(data,'guides').guideOrder[0]);
  assert.equal(section(home,'guides').guides.length,getListeningGuides(catalogue).length);
  assert.equal(section(home,'pick').track.id,'black-skirts');
  assert.deepEqual([...readSaved('["black-skirts","yoon-mirae"]',catalogue.records)],['black-skirts']);
  assert.equal(JSON.stringify(context),snapshot);
});

test('lead story defaults to latest public content, supports a pin and may be hidden',()=>{
  const data=source();
  assert.equal(section(resolveHome(data,context),'story').story.id,'latest');
  section(data,'story').storyId='older';
  assert.equal(section(resolveHome(data,context),'story').story.id,'older');
  section(data,'story').enabled=false;
  assert.equal(section(resolveHome(data,context),'story'),undefined);
  section(data,'story').storyId=null;
  section(data,'story').enabled=true;
  assert.equal(section(resolveHome(data,{...context,stories:[]}),'story').story,undefined);
});

test('image ownership is stable when sections move; a hidden hero frees a pick cover',()=>{
  const data=source();
  section(data,'pick').trackId='black-skirts';
  const home=resolveHome(data,context);
  assert.equal(section(home,'pick').showImage,false);
  data.sections.reverse();
  assert.equal(section(resolveHome(data,context),'pick').showImage,false);
  section(data,'discover').enabled=false;
  assert.equal(section(resolveHome(data,context),'pick').showImage,true);
  const image=catalogue.editorPick.image;
  const stories=[{...context.stories[1],cover:{file:image}}];
  section(data,'pick').trackId=catalogue.editorPick.id;
  const shared=resolveHome(data,{...context,stories});
  assert.equal(section(shared,'story').showImage,true);
  assert.equal(section(shared,'pick').showImage,false);
});

test('On stage keeps an image when its preferred cover is the lead story, without borrowing from another guide',()=>{
  const data=source();
  section(data,'guides').layout='cards';
  const stories=[{...context.stories[1],cover:{file:'sunwoojunga.jpg'}}];
  const home=resolveHome(data,{...context,stories});
  const cards=section(home,'guides');
  const onStage=cards.guides.find(g=>g.id==='on-stage');
  assert.equal(onStage.cardArtwork.artistId,'car-the-garden');
  assert.equal(onStage.cardArtwork.image,'car-the-garden.jpg');
  assert.ok(cards.imageGuideIds.includes('on-stage'));
  for (const guide of cards.guides) {
    assert.ok([...guide.records,...(guide.moreRecords||[])].some(t=>t.id===guide.cardArtwork.id));
  }
  assert.equal(new Set(cards.guides.map(g=>g.cardArtwork.image)).size,cards.guides.length);
  assert.equal(cards.guides.find(g=>g.id==='distinct-voices').cardArtwork.artistId,'hanroro');
  assert.equal(cards.guides.find(g=>g.id==='korean-indie-where-to-start').cardArtwork.artistId,'ydbb');
  assert.equal(catalogue.listeningGuides.find(g=>g.id==='on-stage').cardImageArtistId,'sunwoojunga');
  data.sections.reverse();
  assert.equal(section(resolveHome(data,{...context,stories}),'guides').guides.find(g=>g.id==='on-stage').cardArtwork.id,onStage.cardArtwork.id);
});

test('artist spotlights use existing content and only published related stories, with a song fallback',()=>{
  const data=source();
  const stories=[
    {id:'unrelated',slug:'unrelated',status:'published',published:'2025-04-01',artistIds:['motte']},
    {id:'future',slug:'future',status:'published',published:'2999-01-01',artistIds:['yerin-baek']},
    {id:'draft',slug:'draft',status:'draft',published:'2025-03-01',artistIds:['yerin-baek']},
    {id:'yerin',slug:'yerin',status:'published',published:'2025-02-01',artistIds:['yerin-baek']},
  ];
  const spots=section(resolveHome(data,{...context,stories}),'discover').spotlights;
  assert.deepEqual(spots.map(s=>s.record.artistId),['gongwon','yerin-baek']);
  assert.deepEqual(spots[0].links.map(l=>l.href),['/artists/gongwon/#lyrics','/artists/gongwon/#gongwon-live-0']);
  assert.deepEqual(spots[1].links.map(l=>l.href),['/artists/yerin-baek/#lyrics','/stories/yerin/','/artists/yerin-baek/#more-listens-title']);
  const multi=structuredClone(catalogue),gongwon=multi.records.find(t=>t.id==='gongwon');
  gongwon.primaryTrackId='new-song';
  multi.records.push({...gongwon,id:'new-song',lyricNotes:undefined});
  assert.equal(section(resolveHome(data,{...context,catalogue:multi}),'discover').spotlights[0].links[0].href,'/artists/gongwon/#lyrics-gongwon');
  section(data,'discover').spotlightArtistIds=['motte'];
  const withoutNotes=structuredClone(catalogue);
  delete withoutNotes.records.find(t=>t.id==='motte').lyricNotes;
  assert.deepEqual(section(resolveHome(data,{...context,catalogue:withoutNotes}),'discover').spotlights[0].links,[{href:'/artists/motte/#listen',label:'Listen & read'}]);
});

for (const [name,edit,pattern] of [
  ['unknown section',d=>d.sections[0].type='unknown',/unknown section type/],
  ['misspelled field',d=>d.sections[0].enable=true,/unknown section field/],
  ['duplicate section IDs',d=>d.sections[1].id=d.sections[0].id,/duplicate section ID/],
  ['duplicate singleton designs',d=>d.sections.push({...d.sections[0],id:'second'}),/duplicate singleton/],
  ['nonboolean visibility',d=>d.sections[0].enabled='false',/boolean enabled/],
  ['missing copy',d=>delete d.sections[0].copy.title,/nonempty text/],
  ['broken track reference',d=>section(d,'pick').trackId='missing',/unknown pick track/],
  ['duplicate track order',d=>section(d,'discover').trackOrder=['gongwon','gongwon'],/unique IDs/],
  ['missing spotlight artist',d=>section(d,'discover').spotlightArtistIds=['missing'],/unknown spotlight artist/],
  ['duplicate spotlight artists',d=>section(d,'discover').spotlightArtistIds=['gongwon','gongwon'],/two distinct artists/],
  ['too many spotlights',d=>section(d,'discover').spotlightArtistIds=['gongwon','yerin-baek','motte'],/two distinct artists/],
  ['unknown guide layout',d=>section(d,'guides').layout='missing',/unknown guides layout/],
  ['missing artist',d=>section(d,'discover').features=[{id:'missing'}],/unknown or unpublished featured artist/],
  ['draft guide',d=>section(d,'guides').guideOrder=[catalogue.listeningGuides.find(g=>g.status==='draft').id],/unknown or unpublished guideOrder/],
  ['draft story',d=>section(d,'story').storyId='draft',/unknown or unpublished story/],
  ['future story',d=>section(d,'story').storyId='future',/unknown or unpublished story/],
  ['stale hidden reference',d=>{section(d,'pick').enabled=false;section(d,'pick').trackId='missing';},/unknown pick track/],
  ['arbitrary HTML in a deck',d=>section(d,'discover').features[0].deck='<img src=x>',/only <em>/],
  ['unbalanced deck emphasis',d=>section(d,'discover').features[0].deck='<em>hello',/unbalanced/],
  ['uncredited photo',d=>Object.assign(section(d,'discover').features[0],{image:'missing.jpg',alt:'Missing',kind:'portrait'}),/uncredited or missing/],
  ['photo without alt',d=>{section(d,'discover').features[0].image='ydbb.jpg';delete section(d,'discover').features[0].alt;},/needs alt and kind/],
  ['duplicate hero photo',d=>Object.assign(section(d,'discover').features[0],{image:getFeaturedArtists(catalogue)[1].image,alt:'Duplicate',kind:'portrait'}),/duplicate hero image/],
]) test(`home validation rejects ${name}`,()=>{
  const data=source(); edit(data);
  assert.throws(()=>resolveHome(data,context),pattern);
});

test('isolated builds support rearrangement, different picks and hidden sections while preserving other pages',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'indiek-home-build-'));
  try {
    for (const folder of ['scripts','site','content','.openai']) cpSync(path.join(root,folder),path.join(dir,folder),{recursive:true});
    mkdirSync(path.join(dir,'dist'));
    cpSync(path.join(root,'dist/assets'),path.join(dir,'dist/assets'),{recursive:true});
    cpSync(path.join(root,'dist/favicon.svg'),path.join(dir,'dist/favicon.svg'));
    const data=source();
    data.sections.reverse();
    section(data,'discover').features.unshift({id:'gongwon'});
    section(data,'discover').trackOrder=['yoon-mirae','gongwon'];
    section(data,'guides').guideOrder=getListeningGuides(catalogue).map(g=>g.id).reverse();
    section(data,'pick').trackId='black-skirts';
    section(data,'pick').copy.description='Home-only copy <script>escaped</script>.';
    function build() {
      writeFileSync(path.join(dir,'content/home.json'),JSON.stringify(data));
      execFileSync(process.execPath,['scripts/build.mjs'],{cwd:dir,stdio:'pipe'});
      execFileSync('python3',['scripts/check.py'],{cwd:dir,stdio:'pipe'});
      return readFileSync(path.join(dir,'dist/index.html'),'utf8');
    }
    let html=build();
    assert.ok(html.indexOf('data-home-section="about"')<html.indexOf('data-home-section="masthead"'));
    assert.ok(html.indexOf('data-hero-artist="gongwon"')<html.indexOf('data-hero-artist="ydbb"'));
    assert.match(html,/Home-only copy &lt;script&gt;escaped&lt;\/script&gt;/);
    assert.match(html,/data-save="black-skirts"/);
    assert.ok(!html.includes('data-save="yoon-mirae"'));
    assert.match(html,/editor-pick pick-preview wrap home-text-only/);
    for (const file of ['artists/black-skirts/index.html','notes/first-listens/index.html','stories/index.html','catalogue.js','promotion-catalogue.json']) {
      assert.equal(readFileSync(path.join(dir,'dist',file),'utf8'),readFileSync(path.join(root,'dist',file),'utf8'),`Home edits changed ${file}`);
    }
    for (const s of data.sections) if (!['updates','closing'].includes(s.type)) s.enabled=false;
    html=build();
    assert.ok(!html.includes('id="artist-carousel"'));
    assert.ok(!html.includes('data-room-track='));
    assert.ok(!html.includes('data-guide='));
    assert.match(html,/<h1 class="sr-only">indiek<\/h1>/);
    for (const id of ['discover','records','editors-pick','notes','about']) assert.match(html,new RegExp(`id="${id}"`));
    assert.equal((html.match(/id="persistent-player"/g)||[]).length,1);
    assert.ok(!html.includes('<iframe'));

    // A synthetic home-only image must survive image preparation even while hidden.
    const original=getFeaturedArtists(catalogue).find(f=>f.kind==='portrait').image;
    const fixture='home-photo-fixture'+path.extname(original);
    cpSync(path.join(dir,'dist/assets',original),path.join(dir,'dist/assets',fixture));
    Object.assign(section(data,'discover').features[0],{image:fixture,alt:'Image pipeline fixture',kind:'portrait'});
    writeFileSync(path.join(dir,'content/home.json'),JSON.stringify(data));
    execFileSync('python3',['scripts/prepare-images.py'],{cwd:dir,stdio:'pipe'});
    const prepared=JSON.parse(readFileSync(path.join(dir,'content/media.json'),'utf8'));
    assert.ok(prepared[fixture].variants.length>0);
    assert.equal(prepared[fixture].width,context.media[original].width);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
