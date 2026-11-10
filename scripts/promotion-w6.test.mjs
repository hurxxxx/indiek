import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,copyFileSync,existsSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {threadsSlot,carouselSlot,timerCalendars,validateSchedule} from './promotion/schedule.mjs';
import {validateAccounts,renderTags,validateTags,validateTagTokens,tagsStillRecorded} from './promotion/tags.mjs';
import {carouselDecks,buildCarousels,prepareCarousel,verifyCarouselPost,validateManifest,carouselCandidates,builtPages} from './promotion/carousel.mjs';
import {createHash} from 'node:crypto';
import {validatePost,publishPost,hash,payloadParts} from './promotion/core.mjs';
import {metaClient} from './promotion/meta.mjs';
import {sharePageNow,verifyPagePost} from './promotion/page-now.mjs';
import {promotionUnits} from '../deploy/install-promotion.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url));
const config=JSON.parse(readFileSync(path.join(repo,'promotion/config.json'),'utf8'));
const schedule=config.schedule;

test('Threads posts daily at the 16:00 KST activity peak and never fills an elapsed slot',()=>{
  validateSchedule(schedule);
  assert.equal(schedule.threads.time,'16:00');
  assert.deepEqual(threadsSlot(new Date('2026-11-13T06:59:00Z'),schedule),{platform:'threads',scheduledAt:'2026-11-13T07:00:00.000Z',id:'T-2026-11-13-1600-page'});
  assert.equal(threadsSlot(new Date('2026-11-13T07:00:00Z'),schedule,'story').id,'T-2026-11-14-1600-story');
  assert.equal(threadsSlot(new Date('2026-11-13T23:30:00Z'),schedule).scheduledAt,'2026-11-14T07:00:00.000Z');
});

test('Instagram gets carousel slots on Friday and Sunday only, prepared the same morning',()=>{
  assert.deepEqual(carouselSlot(new Date('2026-11-13T00:00:00Z'),schedule),{platform:'instagram',scheduledAt:'2026-11-13T08:00:00.000Z',id:'I-2026-11-13-1700-carousel'});
  assert.equal(carouselSlot(new Date('2026-11-15T00:00:00Z'),schedule).id,'I-2026-11-15-1700-carousel');
  for(const day of ['2026-11-09','2026-11-10','2026-11-11','2026-11-12','2026-11-14'])assert.equal(carouselSlot(new Date(`${day}T00:00:00Z`),schedule),null);
  assert.equal(carouselSlot(new Date('2026-11-13T08:00:00Z'),schedule),null);
  assert.throws(()=>validateSchedule({...schedule,instagram:{...schedule.instagram,format:'card'}}),/carousel/);
});

test('installed timer units match the configured schedule and every unit has files',()=>{
  const unit=name=>readFileSync(path.join(repo,`deploy/systemd/indiek-promotion-${name}.timer`),'utf8');
  const calendar=name=>unit(name).match(/^OnCalendar=(.+)$/m)[1];
  const expected=timerCalendars(schedule);
  assert.equal(calendar('threads'),expected.threads);assert.equal(calendar('instagram'),expected.instagram);
  assert.equal(calendar('prepare'),'*-*-* 08:00:00 Asia/Seoul');
  assert.equal(calendar('engage'),'*-*-* 09,13,17,21:30:00 Asia/Seoul');
  for(const name of promotionUnits){
    assert.ok(existsSync(path.join(repo,`deploy/systemd/indiek-promotion-${name}.service`)));
    assert.match(unit(name),new RegExp(`Unit=indiek-promotion-${name}\\.service`));
  }
  assert.match(readFileSync(path.join(repo,'deploy/systemd/indiek-promotion-engage.service'),'utf8'),/run\.mjs engage run$/m);
  const installed=readdirSync(path.join(repo,'deploy/systemd')).filter(f=>/^indiek-promotion-.+\.timer$/.test(f)).map(f=>f.slice(17,-6)).sort();
  assert.deepEqual(installed,[...promotionUnits].sort());
});

const registry={version:1,accounts:[{artistId:'a-song',platform:'instagram',handle:'a.song_official',source:'https://label.example/a-song',sourceNote:'Label artist page links this account.',checkedAt:'2026-11-09'}]};

test('artist tags come only from the official account registry, per platform',()=>{
  validateAccounts(registry);
  assert.throws(()=>validateAccounts({version:1,accounts:[{...registry.accounts[0],source:'http://insecure.example'}]}),/HTTPS/);
  assert.throws(()=>validateAccounts({version:1,accounts:[{...registry.accounts[0],checkedAt:''}]}),/source note/);
  const draft='A Song [[tag:a-song]] keeps the rain outside the room.';
  validateTagTokens(draft,['a-song']);
  assert.throws(()=>validateTagTokens('A Song @someone keeps the rain out.',['a-song']),/runner fills/);
  assert.throws(()=>validateTagTokens('A [[tag:other]] B',['a-song']),/only the artists/);
  const instagram=renderTags(draft,'instagram',['a-song'],registry),threads=renderTags(draft,'threads',['a-song'],registry);
  assert.equal(instagram.copy,'A Song (@a.song_official) keeps the rain outside the room.');
  assert.equal(threads.copy,'A Song keeps the rain outside the room.');assert.deepEqual(threads.tags,[]);
  validateTags(instagram.copy,instagram.tags);
  assert.throws(()=>validateTags(instagram.copy,[]),/match/);
  assert.throws(()=>validateTags(`${instagram.copy} @stranger`,instagram.tags),/match/);
  assert.throws(()=>tagsStillRecorded({platform:'instagram',artistIds:['a-song'],tags:instagram.tags},{version:1,accounts:[]}),/no longer/);
});

function workspace(t) {
  const root=mkdtempSync(path.join(tmpdir(),'indiek-w6-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const put=(file,value)=>{mkdirSync(path.dirname(path.join(root,file)),{recursive:true});writeFileSync(path.join(root,file),typeof value==='string'?value:JSON.stringify(value));};
  put('promotion/voice.md','Open with a concrete scene. Tag only recorded official accounts.');
  put('docs/promotion.md','# Manual history\n');
  for(const f of ['SKILL.md','references/editing.md','references/benchmarks.json'])put(`skills/indiek-editorial/${f}`,'Explain verified words.');
  const long='The speaker counts the hours. '.repeat(26).trim();
  const second='The chorus moves the clock forward by one hour.';
  put('content/catalogue.json',{artists:[{id:'a-song',artist:'A Song',primaryTrackId:'t1'},{id:'no-notes',artist:'Quiet',primaryTrackId:'t2'},{id:'song-page',artist:'Song Page',primaryTrackId:'t3'}],tracks:[{id:'t1',artistId:'a-song',slug:'rainy-room',track:'Rainy Room',lyricNotes:{heading:'A whole world in a room',paragraphs:['Two people in a room on a rainy day, with little need to speak.',long]}},{id:'t2',artistId:'no-notes',track:'Plain'},{id:'t3',artistId:'song-page',slug:'quiet-hours',track:'Quiet Hours',lyricNotes:{heading:'Late clocks',paragraphs:[second]}}]});
  const catalogue={version:1,origin:'https://indiek.com',items:[
    {id:'a-song',kind:'artist',title:'A Song — Rainy Room',path:'/artists/a-song/',description:'Lyric notes on a rainy room.',artistIds:['a-song'],image:'/assets/social/artists-a-song.jpg',altText:'card'},
    {id:'no-notes',kind:'artist',title:'Quiet — Plain',path:'/artists/no-notes/',description:'No notes.',artistIds:['no-notes'],image:'/assets/social/artists-no-notes.jpg',altText:'card'},
    {id:'song-page',kind:'artist',title:'Song Page — Quiet Hours',path:'/artists/song-page/',description:'Artist hub.',artistIds:['song-page'],image:'/assets/social/artists-song-page.jpg',altText:'card'}]};
  put('dist/promotion-catalogue.json',catalogue);
  // Built pages: full notes on the A Song artist page; only a preview on the Song Page artist page, full notes on its song page.
  const html=(canonical,description,body)=>`<html><head><meta name="description" content="${description}"><link rel="canonical" href="https://indiek.com${canonical}"></head><body><main>${body}</main></body></html>`;
  put('dist/artists/a-song/index.html',html('/artists/a-song/','Rainy Room &amp; its lyric notes.',`<p>Two people in a room on a rainy day, with little need to speak.</p><p>${long}</p>`));
  put('dist/artists/a-song/rainy-room/index.html',html('/artists/a-song/rainy-room/','Song page.',`<p>Two people in a room on a rainy day, with little need to speak.</p><p>${long}</p>`));
  put('dist/artists/song-page/index.html',html('/artists/song-page/','Artist hub.','<section class="lyric-preview"><h3>Late clocks</h3><a href="/artists/song-page/quiet-hours/">Read the lyric notes</a></section>'));
  put('dist/artists/song-page/quiet-hours/index.html',html('/artists/song-page/quiet-hours/','“Quiet Hours” lyric notes, credits and background.',`<p>${second}</p>`));
  for(const f of ['font-1.ttf','font-3.ttf']){mkdirSync(path.join(root,'dist/assets'),{recursive:true});copyFileSync(path.join(repo,'dist/assets',f),path.join(root,'dist/assets',f));}
  mkdirSync(path.join(root,'scripts/promotion'),{recursive:true});copyFileSync(path.join(repo,'scripts/promotion/carousel-images.py'),path.join(root,'scripts/promotion/carousel-images.py'));
  return {root,put,catalogue,long};
}

test('commentary carousels reproduce published lyric notes as own 4:5 slides with alt text',t=>{
  const {root,catalogue,long}=workspace(t);
  const manifest=buildCarousels(root);
  const pageText=pagePath=>{const file=path.join(root,'dist',pagePath,'index.html');return existsSync(file)?{text:readFileSync(file,'utf8').replace(/<[^>]*>/g,' '),description:'page'}:null;};
  const decks=carouselDecks(JSON.parse(readFileSync(path.join(root,'content/catalogue.json'),'utf8')),catalogue,pageText);
  assert.deepEqual(carouselDecks(JSON.parse(readFileSync(path.join(root,'content/catalogue.json'),'utf8')),catalogue),[],'no built page, no deck');
  // The deck links the page that publishes the notes: the artist page, or the song page when the artist page shows a preview.
  assert.deepEqual(manifest.decks.map(d=>[d.pageId,d.path,d.description]),[['a-song','/artists/a-song/','Rainy Room & its lyric notes.'],['song-page','/artists/song-page/quiet-hours/','“Quiet Hours” lyric notes, credits and background.']]);
  assert.match(decks[1].slides.at(-1).altText,/indiek\.com\/artists\/song-page\/quiet-hours\/$/);
  const slides=decks[0].slides;
  assert.equal(slides[0].kind,'cover');assert.equal(slides.at(-1).kind,'end');
  assert.ok(slides.length>4,'long paragraphs are split at sentence boundaries');
  assert.equal(slides.filter(s=>s.kind==='text').map(s=>s.text).join(' '),`Two people in a room on a rainy day, with little need to speak. ${long}`);
  slides.forEach((s,i)=>{assert.equal(s.image,`/assets/social/carousel/artists-a-song-${i+1}.jpg`);assert.match(s.altText,new RegExp(`^Slide ${i+1} of ${slides.length}\\.`));});
  validateManifest(manifest,'https://indiek.com');
  const first=readFileSync(path.join(root,'dist',slides[0].image));
  assert.equal(first.readUInt16BE(0),0xffd8);
  const sof=first.indexOf(Buffer.from([0xff,0xc0]));assert.equal(first.readUInt16BE(sof+5),1350);assert.equal(first.readUInt16BE(sof+7),1080);
  // A stale slide from a removed page is cleaned up; unchanged slides keep identical bytes.
  writeFileSync(path.join(root,'dist/assets/social/carousel/artists-gone-1.jpg'),'old');
  const again=buildCarousels(root);
  assert.deepEqual(again,manifest);assert.equal(existsSync(path.join(root,'dist/assets/social/carousel/artists-gone-1.jpg')),false);
});

function carouselFixture(t,{reject=false,accounts=registry}={}) {
  const ws=workspace(t);const manifest=buildCarousels(ws.root);
  ws.put('promotion/artist-accounts.json',accounts);
  const store={posts:[],days:[],save(p){const i=this.posts.findIndex(o=>o.id===p.id);if(i<0)this.posts.push(p);else this.posts[i]=p;},day(d){this.days.push(d);}};
  const stats={asks:0,inspects:0};
  const deck=manifest.decks[0];
  const options={root:ws.root,store,catalogue:ws.catalogue,manifest,config:{...config,previousPosts:[]},
    inspect:async()=>{stats.inspects++;return {htmlSHA256:'a'.repeat(64),text:'page'};},
    ask:async prompt=>{stats.asks++;const final=prompt.includes('Final copy: ');return final?{copy:JSON.parse(prompt.split('Final copy: ')[1]),approved:!reject,reason:'Checked against the notes.',issues:reject?['Opening is generic']:[]}:{copy:'Two people in a rainy room, barely speaking: that is the whole world of A Song [[tag:a-song]] and Rainy Room.',approved:true,reason:'draft',issues:[]};}};
  return {...ws,manifest,deck,store,stats,options};
}

test('Friday carousel preparation queues one reviewed Instagram job with a recorded tag and never sends',async t=>{
  const {options,store,stats,deck}=carouselFixture(t);
  const friday=new Date('2026-11-13T00:00:00Z');
  assert.equal((await prepareCarousel({...options,now:new Date('2026-11-12T00:00:00Z')})).status,'no-carousel-slot');
  const result=await prepareCarousel({...options,now:friday});
  assert.equal(result.status,'carousel-prepared');assert.equal(stats.asks,2);
  const post=store.posts[0];
  assert.equal(post.id,'I-2026-11-13-1700-carousel');assert.equal(post.scheduledAt,'2026-11-13T08:00:00.000Z');
  assert.equal(post.slides.length,deck.slides.length);assert.match(post.copy,/A Song \(@a\.song_official\) and Rainy Room\.\n\nhttps:\/\/indiek\.com\/artists\/a-song\/\?from=instagram$/);
  assert.deepEqual(post.tags,[{artistId:'a-song',handle:'a.song_official'}]);
  validatePost(post,options.config);
  assert.equal((await prepareCarousel({...options,now:friday})).status,'carousel-already-prepared');assert.equal(stats.asks,2);
  // Changing a slide or the caption invalidates the reviewed payload.
  const changed={...post,slides:post.slides.map((s,i)=>i?s:{...s,imageUrl:'https://indiek.com/assets/social/carousel/artists-a-song-9.jpg'})};
  assert.throws(()=>validatePost(changed,options.config),/in order/);
  assert.throws(()=>validatePost({...post,copy:post.copy+' extra'},options.config),/review|changed/);
});

test('rejected carousel captions stay unsent and restarts cannot reset the version budget',async t=>{
  const {options,store,stats}=carouselFixture(t,{reject:true});
  options.config={...options.config,editorial:{...options.config.editorial,maxDailyCandidates:1}};
  const friday=new Date('2026-11-13T00:00:00Z');
  assert.equal((await prepareCarousel({...options,now:friday})).status,'held');
  const calls=stats.asks;assert.equal(calls,2*options.config.editorial.maxCaptionVersions);
  assert.equal((await prepareCarousel({...options,now:friday})).status,'held');assert.equal(stats.asks,calls);assert.equal(store.posts.length,0);
});

test('missing carousel manifest or an Instagram post already today leaves Instagram resting',async t=>{
  const {options}=carouselFixture(t);const friday=new Date('2026-11-13T00:00:00Z');
  assert.equal((await prepareCarousel({...options,manifest:null,now:friday})).status,'skipped');
  assert.equal((await prepareCarousel({...options,now:friday,recentPosts:[{platform:'instagram',publishedAt:'2026-11-13T00:30:00Z'}]})).status,'carousel-slot-occupied');
  assert.deepEqual(carouselCandidates(options.manifest,options.catalogue,[],[{platform:'instagram',copy:'https://indiek.com/artists/a-song/?from=instagram',publishedAt:'2026-11-01T00:00:00Z'}],friday).map(d=>d.pageId),['song-page']);
  assert.equal(carouselCandidates(options.manifest,options.catalogue,[],[{platform:'threads',copy:'https://indiek.com/artists/a-song/?from=threads',publishedAt:'2026-11-12T00:00:00Z'}],friday).length,2);
});

test('send-time carousel check refuses changed slides, pages or tags',async t=>{
  const {options,store}=carouselFixture(t);await prepareCarousel({...options,now:new Date('2026-11-13T00:00:00Z')});
  const post=store.posts[0],base={root:options.root,catalogue:options.catalogue,manifest:options.manifest,origin:'https://indiek.com'};
  await verifyCarouselPost(post,{...base,inspect:options.inspect});
  await assert.rejects(verifyCarouselPost(post,{...base,inspect:async()=>({htmlSHA256:'b'.repeat(64)})}),/changed/);
  writeFileSync(path.join(options.root,'promotion/artist-accounts.json'),JSON.stringify({version:1,accounts:[]}));
  await assert.rejects(verifyCarouselPost(post,{...base,inspect:options.inspect}),/registry/);
});

test('the Instagram client builds a carousel from child containers and puts the caption on the parent only',async t=>{
  const {options,store}=carouselFixture(t);await prepareCarousel({...options,now:new Date('2026-11-13T00:00:00Z')});
  const post=store.posts[0],calls=[];
  const fetcher=async(url,init)=>{
    const body=init.body?Object.fromEntries(init.body):Object.fromEntries(new URL(url).searchParams);calls.push({path:new URL(url).pathname,method:init.method,body});
    if(init.method==='GET')return new Response(JSON.stringify({status_code:'FINISHED'}),{status:200});
    return new Response(JSON.stringify({id:String(100+calls.length)}),{status:200});
  };
  const api=metaClient('instagram',{token:'token',userId:'42'},{fetcher,sleep:async()=>{}});
  const result=await api.create(post);
  const children=calls.filter(c=>c.method==='POST'&&c.body.is_carousel_item==='true');
  assert.equal(children.length,post.slides.length);
  children.forEach((c,i)=>{assert.equal(c.body.image_url,post.slides[i].imageUrl);assert.equal(c.body.alt_text,post.slides[i].altText);assert.equal(c.body.caption,undefined);});
  const parent=calls.at(-1);
  assert.equal(parent.body.media_type,'CAROUSEL');assert.equal(parent.body.caption,post.copy);assert.equal(parent.body.children.split(',').length,post.slides.length);
  assert.ok(result.id);
  await assert.rejects(metaClient('threads',{token:'t',userId:'1'},{fetcher}).create(post),/Instagram/);
});

test('a reviewed carousel publishes once through the shared publisher',async t=>{
  const {options,store}=carouselFixture(t);await prepareCarousel({...options,now:new Date('2026-11-13T00:00:00Z')});
  const post=store.posts[0];let creates=0,publishes=0;
  const api={identity:async()=>({username:'indiekdotcom'}),create:async p=>{creates++;assert.equal(p.kind,'carousel');return {id:'parent'};},container:async()=>'FINISHED',publish:async()=>{publishes++;return {id:'media'};},media:async()=>({id:'media',caption:post.copy,permalink:'https://www.instagram.com/p/x/',timestamp:'2026-11-13T08:00:30Z'}),recent:async()=>[]};
  const now=new Date('2026-11-13T08:00:10Z');
  await publishPost(post,{config:options.config,store,api,now,verify:async()=>{},sleep:async()=>{}});
  await publishPost(post,{config:options.config,store,api,now,verify:async()=>{},sleep:async()=>{}});
  assert.equal(post.status,'published');assert.equal(creates,1);assert.equal(publishes,1);
});

test('page captions carry a recorded tag on the matching platform and are re-checked at send time',async t=>{
  const root=mkdtempSync(path.join(tmpdir(),'indiek-tag-page-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const put=(file,value)=>{mkdirSync(path.dirname(path.join(root,file)),{recursive:true});writeFileSync(path.join(root,file),value);};
  put('promotion/voice.md','Concrete scenes.');for(const f of ['SKILL.md','references/editing.md','references/benchmarks.json'])put(`skills/indiek-editorial/${f}`,'Verified words.');
  put('promotion/artist-accounts.json',JSON.stringify({version:1,accounts:[{artistId:'a-song',platform:'threads',handle:'asong',source:'https://label.example/',sourceNote:'Label page links it.',checkedAt:'2026-11-09'}]}));
  const item={id:'a-song',kind:'artist',path:'/artists/a-song/',image:'/assets/social/artists-a-song.jpg',description:'Notes.',altText:'card',artistIds:['a-song']};
  const store={posts:[],save(p){const i=this.posts.findIndex(o=>o.id===p.id);if(i<0)this.posts.push(p);else this.posts[i]=p;}};
  const prompts=[];
  const options={root,store,config:{...config,previousPosts:[]},catalogue:{items:[item]},kind:'artist',pageId:'a-song',clock:()=>new Date('2026-11-10T03:00:00Z'),recent:async()=>[],apiFor:()=>({}),
    verify:async()=>({htmlSHA256:'a'.repeat(64),imageSHA256:'b'.repeat(64),text:'page'}),
    ask:async prompt=>{prompts.push(prompt);return prompt.includes('Final copy: ')?{copy:JSON.parse(prompt.split('Final copy: ')[1]),approved:true,reason:'ok',issues:[]}:{copy:'Why does a love song stay inside one rainy room? A Song [[tag:a-song]] answers in the second verse.',approved:true,reason:'draft',issues:[]};},
    send:async(p,{store})=>{p.status='published';store.save(p);}};
  assert.equal((await sharePageNow(options)).status,'published');
  assert.match(prompts[0],/OPENING \(voice guide D6\)/);assert.match(prompts[0],/OFFICIAL ACCOUNTS/);
  const threads=store.posts.find(p=>p.platform==='threads'),instagram=store.posts.find(p=>p.platform==='instagram');
  assert.match(threads.copy,/A Song \(@asong\) answers/);assert.deepEqual(threads.tags,[{artistId:'a-song',handle:'asong'}]);
  assert.match(instagram.copy,/A Song answers/);assert.equal(instagram.tags,undefined);
  for(const post of store.posts)validatePost(post,options.config);
  assert.equal(hash(payloadParts(instagram)),instagram.payloadHash,'untagged jobs keep the original payload shape');
  writeFileSync(path.join(root,'promotion/artist-accounts.json'),JSON.stringify({version:1,accounts:[]}));
  await assert.rejects(verifyPagePost(threads,{root,catalogue:options.catalogue,inspect:async()=>({htmlSHA256:'a'.repeat(64),imageSHA256:'b'.repeat(64)})}),/registry/);
});

// Guards the committed build: `npm run build` must have regenerated the slides after the last content change.
test('the built site publishes carousels that match the current lyric notes',()=>{
  const read=file=>JSON.parse(readFileSync(path.join(repo,file),'utf8'));
  const manifest=validateManifest(read('dist/promotion-carousels.json'),config.origin);
  const expected=carouselDecks(read('content/catalogue.json'),read('dist/promotion-catalogue.json'),builtPages(path.join(repo,'dist')));
  const shape=decks=>decks.map(d=>({pageId:d.pageId,path:d.path,description:d.description,slides:d.slides.map(({kind,image,altText,text})=>({kind,image,altText,...(kind==='text'?{text}:{})}))}));
  assert.deepEqual(shape(manifest.decks),shape(expected),'run npm run build to regenerate carousel slides');
  for(const slide of manifest.decks.flatMap(d=>d.slides))assert.equal(createHash('sha256').update(readFileSync(path.join(repo,'dist',slide.image))).digest('hex'),slide.sha256);
  const files=readdirSync(path.join(repo,'dist/assets/social/carousel')).sort();
  assert.deepEqual(files,manifest.decks.flatMap(d=>d.slides.map(s=>path.basename(s.image))).sort());
});
