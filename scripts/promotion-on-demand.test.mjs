import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {shareStoryNow} from './promotion/on-demand.mjs';
import {prepareStory} from './promotion/stories.mjs';
import {storyDigest} from './editorial/content.mjs';
import {verifyLive,publishPost} from './promotion/core.mjs';

function fixture(t) {
  const root=mkdtempSync(path.join(tmpdir(),'indiek-story-now-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const put=(file,value)=>{mkdirSync(path.dirname(path.join(root,file)),{recursive:true});writeFileSync(path.join(root,file),value);};
  const story={id:'a-song',slug:'a-song',status:'published',published:'2026-10-20',title:'A song',description:'A specific detail',sources:[],blocks:[]};
  put('content/stories/a-song.json',JSON.stringify(story));put('promotion/voice.md','Use specific facts.');
  for(const f of ['SKILL.md','references/editing.md','references/benchmarks.json'])put(`skills/indiek-editorial/${f}`,'Read original sources.');
  const item={id:story.id,kind:'story',path:'/stories/a-song/',published:story.published,revision:storyDigest(story),artistIds:[],image:'/assets/social/stories-a-song.jpg',altText:'Original type card',description:story.description};
  const store={posts:[],save(p){const i=this.posts.findIndex(old=>old.id===p.id);if(i<0)this.posts.push(p);else this.posts[i]=p;}};
  const stats={asks:0,sends:0,receipts:0};
  const options={root,store,storyId:story.id,config:{origin:'https://indiek.com',platforms:['threads','instagram'],previousPosts:[],maxSlotAgeMinutes:120},catalogue:{items:[item]},
    clock:()=>new Date('2026-10-20T07:50:00Z'),recent:async()=>[],apiFor:()=>({}),
    ask:async(stage,prompt)=>{
      stats.asks++;
      const final=prompt.includes('Final copy: ');
      if(final){assert.ok(prompt.includes('HTTPS receipt: {"verified":true}'));stats.receipts++;}
      return {copy:final?JSON.parse(prompt.split('Final copy: ')[1]):'The songwriter tried starting with a beat.',approved:true,issues:[],reason:'Specific detail checked.'};
    },
    verify:async()=>({verified:true}),
    send:async(p,{store})=>{stats.sends++;p.status='published';p.remoteId=`remote-${p.platform}`;p.permalink=`https://social.example/${p.platform}`;store.save(p);}
  };
  return {options,stats,item,audit:()=>JSON.parse(readFileSync(path.join(root,'promotion/state/stories/on-demand/a-song.json'),'utf8'))};
}

test('explicit story-now writes remotely and preserves daily jobs, then resumes without generating or sending again',async t=>{
  const {options,stats,audit}=fixture(t);
  options.store.posts.push({id:'T-2026-10-21-1000-story',platform:'threads',status:'ready',storyId:'another-song',scheduledAt:'2026-10-21T01:00:00Z'});
  const daily=structuredClone(options.store.posts[0]);
  options.recent=async()=>[{platform:'threads',publishedAt:'2026-10-20T00:00:00Z',copy:'An earlier different post'}];
  const result=await shareStoryNow(options);
  assert.equal(result.status,'published');assert.equal(stats.sends,2);assert.equal(stats.asks,3);assert.equal(stats.receipts,2);
  assert.deepEqual(options.store.posts[0],daily);
  assert.ok(options.store.posts.slice(1).every(p=>p.mode==='on-demand'&&p.scheduledAt==='2026-10-20T07:50:00.000Z'));
  assert.equal(audit().attempts.length,1);assert.equal(audit().results.length,2);
  await shareStoryNow({...options,clock:()=>new Date('2026-10-21T08:00:00Z')});
  assert.equal(stats.sends,2);assert.equal(stats.asks,3);
});

test('queued or actually shared articles cannot start a second request',async t=>{
  const {options,stats}=fixture(t);
  options.recent=async()=>[{platform:'threads',copy:'Read https://indiek.com/stories/a-song/?from=threads'}];
  assert.equal((await shareStoryNow(options)).status,'story-already-queued-or-shared');
  options.recent=async()=>[];
  options.store.posts.push({storyId:'a-song',status:'submitted'});
  assert.equal((await shareStoryNow(options)).status,'story-already-queued-or-shared');
  assert.equal(stats.asks,0);assert.equal(stats.sends,0);
});

test('both reviews must pass; repeated invocations preserve the two-version budget',async t=>{
  const {options,stats,audit}=fixture(t);
  const original=options.ask;
  options.ask=async(stage,prompt)=>{
    const r=await original(stage,prompt);
    return prompt.includes('Final copy: ')?{...r,approved:false,issues:['Unverified detail.']}:r;
  };
  assert.equal((await shareStoryNow(options)).status,'story-held');
  assert.equal(stats.sends,0);assert.equal(options.store.posts.length,0);
  const calls=stats.asks;
  assert.equal((await shareStoryNow(options)).status,'story-held');
  assert.equal(stats.asks,calls);assert.equal(audit().attempts.length,2);
});

test('a crash while queueing resumes the approved jobs without resetting copy or duplicating jobs',async t=>{
  const {options,stats}=fixture(t);
  const save=options.store.save.bind(options.store);let saves=0;
  options.store.save=p=>{if(++saves===2)throw new Error('simulated interruption');save(p);};
  await assert.rejects(shareStoryNow(options),/interruption/);
  assert.equal(options.store.posts.length,1);assert.equal(stats.sends,0);
  options.store.save=save;
  assert.equal((await shareStoryNow(options)).status,'published');
  assert.equal(stats.asks,3);assert.equal(stats.sends,2);assert.equal(options.store.posts.length,2);
});

test('a post appearing during review holds the affected platform before a send',async t=>{
  const {options,stats}=fixture(t);let reads=0;
  options.recent=async()=>++reads===1?[]:[{platform:'threads',copy:'https://indiek.com/stories/a-song/'}];
  const result=await shareStoryNow(options);
  assert.equal(result.status,'held');assert.equal(stats.sends,1);
  assert.equal(options.store.posts.find(p=>p.platform==='threads').status,'held');
});

test('on-demand resumes an uncertain API response by lookup without sending a second post',async t=>{
  const {options,stats}=fixture(t);
  const published=new Map();let creates=0,publishes=0;
  options.send=publishPost;options.config.account='indiekdotcom';
  options.apiFor=platform=>({
    identity:async()=>({username:'indiekdotcom'}),
    create:async p=>{creates++;published.set(platform,{id:platform,caption:p.copy,timestamp:'2026-10-20T07:50:00Z',permalink:`https://social.example/${platform}`});return {id:platform};},
    container:async()=> 'FINISHED',
    publish:async()=>{publishes++;throw new Error('lost response after send');},
    recent:async()=>[published.get(platform)],
    media:async()=>published.get(platform)
  });
  assert.equal((await shareStoryNow(options)).status,'held');
  assert.ok(options.store.posts.every(p=>p.status==='publishing'));
  assert.equal((await shareStoryNow(options)).status,'published');
  assert.equal(creates,2);assert.equal(publishes,2);assert.equal(stats.asks,3);
});

test('article changes and platform restrictions prevent further attempts',async t=>{
  const {options,stats,item}=fixture(t);
  options.store.posts.push({platform:'threads',pausePlatform:true});
  await assert.rejects(shareStoryNow(options),/paused/);assert.equal(stats.asks,0);
  options.store.posts=[];
  await shareStoryNow(options);
  item.revision='f'.repeat(64);
  await assert.rejects(shareStoryNow(options),/revision changed/);
  assert.equal(stats.sends,2);
});

test('ordinary preparation still refuses an extra post on a day with an existing post',async t=>{
  const {options,stats}=fixture(t);
  const result=await prepareStory({...options,now:new Date('2026-10-20T00:00:00Z'),recentPosts:options.config.platforms.map(platform=>({platform,publishedAt:'2026-10-20T00:00:00Z',copy:'Different song'}))});
  assert.equal(result.status,'story-held');assert.equal(options.store.posts.length,0);assert.equal(stats.receipts,0);
});

test('public receipt contains fetched page evidence only after exact revision and image validation',async()=>{
  const post={kind:'story',storyRevision:'a'.repeat(64),url:'https://indiek.com/stories/a-song/?from=threads',imageUrl:'https://indiek.com/assets/social/stories-a-song.jpg',sourceDescription:'A & B'};
  const html=`<link rel="canonical" href="https://indiek.com/stories/a-song/"><main data-story-revision="${post.storyRevision}"><p>A &amp; B</p></main>`;
  const fetcher=async(url,options)=>options.method==='HEAD'?new Response(null,{headers:{'content-type':'image/jpeg'}}):new Response(html,{headers:{'content-type':'text/html'}});
  const receipt=await verifyLive(post,fetcher);
  assert.equal(receipt.status,200);assert.equal(receipt.revision,post.storyRevision);
  assert.equal(receipt.url,'https://indiek.com/stories/a-song/');assert.match(receipt.htmlSHA256,/^[a-f0-9]{64}$/);assert.ok(receipt.text.includes('A & B'));
  await assert.rejects(verifyLive({...post,storyRevision:'b'.repeat(64)},fetcher),/changed/);
});
