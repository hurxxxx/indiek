import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {sharePageNow,prepareDailyPages,pageCandidates,verifyPagePost} from './promotion/page-now.mjs';
import {publishPost,publishScheduledPost,validatePost} from './promotion/core.mjs';
import {remoteRequest,runRemote} from './promotion/remote.mjs';

function fixture(t,kind='artist') {
  const root=mkdtempSync(path.join(tmpdir(),'indiek-page-now-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  mkdirSync(path.join(root,'promotion'));writeFileSync(path.join(root,'promotion/voice.md'),'Use concrete facts and no fabricated listening.');
  const skill=path.join(root,'skills/indiek-editorial');mkdirSync(path.join(skill,'references'),{recursive:true});
  for(const name of ['SKILL.md','references/editing.md','references/benchmarks.json'])writeFileSync(path.join(skill,name),'Explain verified words without exaggerating or inventing intention.');
  const section=kind==='artist'?'artists':'notes';
  const item={id:'a-song',kind,path:`/${section}/a-song/`,image:`/assets/social/${section}-a-song.jpg`,description:'An earlier live performance and English lyric notes.',altText:'Original indiek typography card',artistIds:['a-song']};
  const store={posts:[],save(p){const i=this.posts.findIndex(old=>old.id===p.id);if(i<0)this.posts.push(p);else this.posts[i]=p;}};
  const stats={asks:0,sends:0,verifies:0};
  const options={root,config:{origin:'https://indiek.com',account:'indiekdotcom',platforms:['threads','instagram'],previousPosts:[],maxSlotAgeMinutes:120},store,catalogue:{items:[item]},kind,pageId:item.id,clock:()=>new Date('2026-10-22T13:00:00Z'),recent:async()=>[],apiFor:()=>({}),
    verify:async()=>{stats.verifies++;return {htmlSHA256:'a'.repeat(64),imageSHA256:'b'.repeat(64),text:'A song introduces first love in images. An earlier live performance and English lyric notes.'};},
    ask:async prompt=>{stats.asks++;return {copy:prompt.includes('Final copy: ')?JSON.parse(prompt.split('Final copy: ')[1]):'First love takes shape in a film and a night sky. The page pairs an earlier live performance with English notes.',approved:true,reason:'Exact caption checked against the page.',issues:[]};},
    send:async(p,{store})=>{stats.sends++;p.status='published';p.remoteId='remote-'+p.platform;p.permalink='https://social.example/'+p.platform;store.save(p);}
  };
  const file=path.join(root,`promotion/state/pages/on-demand/${kind}-a-song.json`);
  return {options,stats,item,file,audit:()=>JSON.parse(readFileSync(file,'utf8'))};
}

for(const kind of ['artist','guide'])test(`${kind} immediate API share requires two exact reviews and preserves scheduled jobs`,async t=>{
  const {options,stats,audit}=fixture(t,kind);
  const daily={id:'T-2026-10-23-1000-news',platform:'threads',status:'ready',scheduledAt:'2026-10-23T01:00:00Z'};
  options.store.posts.push(daily);const before=structuredClone(daily);
  assert.equal((await sharePageNow(options)).status,'published');
  assert.equal(stats.sends,2);assert.equal(stats.asks,3);assert.deepEqual(daily,before);
  assert.ok(options.store.posts.slice(1).every(p=>p.mode==='on-demand'&&p.pageKind===kind&&p.scheduledAt==='2026-10-22T13:00:00.000Z'));
  for(const post of options.store.posts.slice(1))validatePost(post,options.config);
  assert.equal(audit().attempts.length,1);
  await sharePageNow(options);assert.equal(stats.sends,2);assert.equal(stats.asks,3);
});

test('scheduled lyric discovery prepares exact reviewed posts without publishing and resumes once',async t=>{
  const {options,stats}=fixture(t);const now=new Date('2026-10-24T00:00:00Z');
  const result=await prepareDailyPages({...options,now});
  assert.equal(result.status,'page-prepared');assert.equal(stats.sends,0);assert.equal(stats.asks,3);
  assert.ok(options.store.posts.every(p=>p.mode==='scheduled'&&p.id.endsWith('-page')));
  for(const p of options.store.posts)validatePost(p,options.config);
  await prepareDailyPages({...options,now});
  assert.equal(stats.asks,3);assert.equal(options.store.posts.length,2);assert.equal(stats.sends,0);
});

test('a scheduled page never consumes an occupied or attempted daily slot',async t=>{
  const {options,stats}=fixture(t);
  const prior={id:'T-2026-10-24-1000-news',kind:'news',platform:'threads',status:'created',scheduledAt:'2026-10-24T01:00:00Z',containerId:'existing'};
  options.store.posts.push(prior);const before=structuredClone(prior);
  assert.equal((await prepareDailyPages({...options,now:new Date('2026-10-24T00:00:00Z')})).status,'page-slot-occupied');
  assert.deepEqual(prior,before);assert.equal(stats.asks,0);assert.equal(stats.sends,0);
});

test('scheduled page rejection budget survives restart and cannot move to a fresh candidate',async t=>{
  const {options,stats,item}=fixture(t);const ask=options.ask;
  options.ask=async prompt=>({...await ask(prompt),...(prompt.includes('Final copy: ')?{approved:false,issues:['Overstated interpretation']}:{})});
  const now=new Date('2026-10-24T00:00:00Z');
  assert.equal((await prepareDailyPages({...options,now})).status,'held');
  const count=stats.asks;
  options.catalogue.items.unshift({...item,id:'different',path:'/artists/different/',image:'/assets/social/artists-different.jpg'});
  assert.equal((await prepareDailyPages({...options,now})).status,'held');
  assert.equal(stats.asks,count);assert.equal(stats.sends,0);assert.equal(options.store.posts.length,0);
});

test('scheduled reviews receive the future target day rather than treating preparation as publication',async t=>{
  const {options}=fixture(t);const ask=options.ask;const prompts=[];
  options.ask=async prompt=>{prompts.push(prompt);return ask(prompt);};
  await prepareDailyPages({...options,now:new Date('2026-10-24T02:00:00Z')});
  assert.equal(prompts.length,3);
  for(const prompt of prompts){assert.match(prompt,/TARGET PUBLICATION DAY: 2026-10-25 Asia\/Seoul/);assert.match(prompt,/2026-10-25T01:00:00/);assert.match(prompt,/preparation is NOT publication/);}
});

test('legacy review-context repair rechecks the same draft once without resetting its two-version budget',async t=>{
  const {options,stats}=fixture(t);const ask=options.ask;const now=new Date('2026-10-24T02:00:00Z');
  options.ask=async prompt=>({...await ask(prompt),...(prompt.includes('Final copy: ')?{approved:false,issues:['Preparation date mistaken for target day']}:{})});
  assert.equal((await prepareDailyPages({...options,now})).status,'held');
  const file=path.join(options.root,'promotion/state/pages/2026-10-25.json');const old=JSON.parse(readFileSync(file,'utf8'));
  delete old.reviewContextVersion;writeFileSync(file,JSON.stringify(old));
  const before=stats.asks;options.ask=ask;
  assert.equal((await prepareDailyPages({...options,now})).status,'page-prepared');
  const result=JSON.parse(readFileSync(file,'utf8'));
  assert.equal(stats.asks-before,2);assert.deepEqual(result.attempts,old.attempts);
  assert.equal(result.contextRechecks.length,1);assert.equal(result.contextRechecks[0].draftVersion,2);
  for(const post of options.store.posts)assert.ok(post.copy.startsWith(old.attempts[1].draft.copy));
  await prepareDailyPages({...options,now});assert.equal(stats.asks-before,2);
});

test('scheduled discovery alternates available kinds and respects actual-account repeat history',()=>{
  const artist={id:'artist',kind:'artist',path:'/artists/artist/'},guide={id:'guide',kind:'guide',path:'/notes/guide/'};
  const now=new Date('2026-10-24T00:00:00Z');
  assert.equal(pageCandidates([artist,guide],[],[],now)[0],artist);
  const prior={kind:'page',pageKind:'artist',status:'published',publishedAt:'2026-10-23T01:00:00Z',url:'https://indiek.com/artists/other/'};
  assert.equal(pageCandidates([artist,guide],[prior],[],now)[0],guide);
  const recent=[{copy:'https://indiek.com/notes/guide/?from=threads',publishedAt:'2026-10-22T01:00:00Z'}];
  assert.deepEqual(pageCandidates([artist,guide],[prior],recent,now),[artist]);
  assert.deepEqual(pageCandidates([artist],[],[{copy:artist.path,publishedAt:'2026-09-01T00:00:00Z'}],now),[artist]);
});

test('changed scheduled page content or image fails before API publication',async t=>{
  const {options}=fixture(t);await prepareDailyPages({...options,now:new Date('2026-10-24T00:00:00Z')});
  const post=options.store.posts[0];
  await assert.rejects(verifyPagePost(post,{root:options.root,catalogue:options.catalogue,inspect:async()=>({htmlSHA256:'changed',imageSHA256:'b'.repeat(64)})}),/changed/);
  assert.equal(post.status,'ready');
});

test('daily publication guard also applies to reviewed scheduled lyric posts',async t=>{
  const {options}=fixture(t);await prepareDailyPages({...options,now:new Date('2026-10-24T00:00:00Z')});
  let apiCalls=0;const post=options.store.posts[0];
  await publishScheduledPost(post,{config:options.config,store:options.store,now:new Date('2026-10-24T01:01:00Z'),recent:async()=>[{platform:'threads',publishedAt:'2026-10-24T00:30:00Z'}],api:{identity:async()=>{apiCalls++;throw new Error('must not publish');}}});
  assert.equal(post.status,'superseded');assert.equal(apiCalls,0);
});

test('revision findings are carried forward until the configured fourth version passes',async t=>{
  const {options,stats}=fixture(t);options.config.editorial={maxCaptionVersions:4,maxDailyCandidates:1};
  const ask=options.ask;let version=0;
  options.ask=async prompt=>{
    if(!prompt.includes('Final copy: ')) {
      version++;
      if(version>1)assert.match(prompt,/Remove the unsupported object detail/);
      return ask(prompt);
    }
    const result=await ask(prompt);
    return version<4?{...result,approved:false,issues:['Remove the unsupported object detail']} : result;
  };
  assert.equal((await sharePageNow(options)).status,'published');
  assert.equal(stats.sends,2);assert.equal(stats.asks,12);
  assert.equal(JSON.parse(readFileSync(path.join(options.root,'promotion/state/pages/on-demand/artist-a-song.json'),'utf8')).attempts.length,4);
});

test('a rejected daily topic falls back to another frozen candidate and queues only that approved pair',async t=>{
  const {options,stats,item}=fixture(t);options.config.editorial={maxCaptionVersions:2,maxDailyCandidates:2};
  options.catalogue.items.push({...item,id:'another',path:'/artists/another/',image:'/assets/social/artists-another.jpg'});
  const ask=options.ask;
  options.ask=async prompt=>{
    const result=await ask(prompt);const page=JSON.parse(prompt.match(/^PUBLIC PAGE: (.+)$/m)[1]);
    return prompt.includes('Final copy: ')&&page.id==='a-song'?{...result,approved:false,issues:['Choose another supported point']} : result;
  };
  const now=new Date('2026-10-25T00:00:00Z');
  assert.equal((await prepareDailyPages({...options,now})).status,'page-prepared');
  assert.equal(stats.asks,9);assert.equal(stats.sends,0);
  assert.ok(options.store.posts.every(p=>p.pageId==='another'&&p.status==='ready'));
  const first=JSON.parse(readFileSync(path.join(options.root,'promotion/state/pages/2026-10-25.json'),'utf8'));
  assert.equal(first.attempts.length,2);assert.ok(first.attempts.every(a=>a.status==='rejected'));
  await prepareDailyPages({...options,now});assert.equal(stats.asks,9);assert.equal(options.store.posts.length,2);
});

test('restarting cannot expand the frozen daily candidate or per-topic draft limits',async t=>{
  const {options,stats,item}=fixture(t);options.config.editorial={maxCaptionVersions:2,maxDailyCandidates:2};
  options.catalogue.items.push({...item,id:'another',path:'/artists/another/',image:'/assets/social/artists-another.jpg'});
  const ask=options.ask;options.ask=async prompt=>({...await ask(prompt),...(prompt.includes('Final copy: ')?{approved:false,issues:['Unsupported']}:{})});
  const now=new Date('2026-10-25T00:00:00Z');
  assert.equal((await prepareDailyPages({...options,now})).status,'held');const count=stats.asks;
  options.catalogue.items.unshift({...item,id:'third',path:'/artists/third/',image:'/assets/social/artists-third.jpg'});
  assert.equal((await prepareDailyPages({...options,now})).status,'held');assert.equal(stats.asks,count);assert.equal(stats.sends,0);
  const manifest=JSON.parse(readFileSync(path.join(options.root,'promotion/state/pages/2026-10-25-selection.json'),'utf8'));
  assert.deepEqual(manifest.candidates.map(i=>i.id),['a-song','another']);
});

test('source or account failures stop preparation rather than trying to bypass them with another topic',async t=>{
  const {options,stats,item}=fixture(t);options.config.editorial={maxCaptionVersions:4,maxDailyCandidates:3};
  options.catalogue.items.push({...item,id:'another',path:'/artists/another/',image:'/assets/social/artists-another.jpg'});
  options.verify=async()=>{throw new Error('Public page unavailable');};
  await assert.rejects(prepareDailyPages({...options,now:new Date('2026-10-25T00:00:00Z')}),/unavailable/);
  assert.equal(stats.asks,0);assert.equal(stats.sends,0);assert.equal(options.store.posts.length,0);
});

test('a draft formatting failure is corrected before independent review instead of ending the run',async t=>{
  const {options,stats,audit}=fixture(t);const ask=options.ask;let drafts=0;
  options.ask=async prompt=>{
    const result=await ask(prompt);
    if(!prompt.includes('Final copy: ')) {
      drafts++;
      if(drafts===1)return {...result,copy:'First love takes shape in a film. https://unwanted.example/'};
      assert.ok(prompt.includes(audit().attempts[0].issue));
    }
    return result;
  };
  assert.equal((await sharePageNow(options)).status,'published');
  assert.equal(audit().attempts.length,2);assert.equal(audit().attempts[0].status,'failed');
  assert.equal(stats.asks,4);assert.equal(stats.sends,2);
});

test('read-only page check verifies live data and duplicates without drafting, queueing or audit writes',async t=>{
  const {options,stats,file}=fixture(t);
  options.recent=async()=>[{platform:'threads',copy:'https://indiek.com/artists/a-song/'}];
  const result=await sharePageNow({...options,checkOnly:true});
  assert.equal(result.status,'checked');assert.equal(result.sent,false);assert.equal(result.alreadyQueuedOrShared,true);
  assert.equal(stats.verifies,1);assert.equal(stats.asks,0);assert.equal(stats.sends,0);assert.equal(options.store.posts.length,0);assert.equal(existsSync(file),false);
});

test('existing manual browser posts also block a new API share',async t=>{
  const {options,stats}=fixture(t);
  options.store.posts.push({kind:'artist',mode:'on-demand',status:'published',url:'https://indiek.com/artists/a-song/?from=instagram'});
  assert.equal((await sharePageNow(options)).status,'already-queued-or-shared');assert.equal(stats.asks,0);assert.equal(stats.sends,0);
});

test('either platform rejecting the caption prevents both sends and restart cannot reset the two-version budget',async t=>{
  const {options,stats,audit}=fixture(t);const ask=options.ask;
  options.ask=async prompt=>({...await ask(prompt),...(prompt.includes('Final copy: ')?{approved:false,issues:['Unsupported claim.']}:{})});
  assert.equal((await sharePageNow(options)).status,'held');assert.equal(stats.sends,0);assert.equal(options.store.posts.length,0);
  const calls=stats.asks;await sharePageNow(options);assert.equal(stats.asks,calls);assert.equal(audit().attempts.length,2);
});

test('interruption while queueing resumes the reviewed pair without duplicate drafting or jobs',async t=>{
  const {options,stats}=fixture(t);const save=options.store.save.bind(options.store);let writes=0;
  options.store.save=p=>{if(++writes===2)throw new Error('queue interrupted');save(p);};
  await assert.rejects(sharePageNow(options),/interrupted/);assert.equal(stats.sends,0);
  options.store.save=save;assert.equal((await sharePageNow(options)).status,'published');
  assert.equal(options.store.posts.length,2);assert.equal(stats.sends,2);assert.equal(stats.asks,3);
});

test('a duplicate appearing during review holds that platform before the API create call',async t=>{
  const {options,stats}=fixture(t);let reads=0;
  options.recent=async()=>++reads===1?[]:[{platform:'threads',copy:'https://indiek.com/artists/a-song/'}];
  assert.equal((await sharePageNow(options)).status,'held');assert.equal(stats.sends,1);
  assert.equal(options.store.posts.find(p=>p.platform==='threads').status,'held');
});

test('page or image changes between review and send stop publication',async t=>{
  const {options,stats}=fixture(t);let checks=0;
  options.verify=async()=>({htmlSHA256:(++checks===1?'a':'c').repeat(64),imageSHA256:'b'.repeat(64),text:'Published page'});
  await assert.rejects(sharePageNow(options),/changed/);assert.equal(stats.sends,0);
  assert.equal(options.store.posts[0].status,'held');
});

test('edited caption reviews invalidate the prepared payload',async t=>{
  const {options}=fixture(t);await sharePageNow(options);const post=options.store.posts[0];
  post.review.reason='A different review';assert.throws(()=>validatePost(post,options.config),/changed/);
});

test('lost API publish responses reconcile the same job rather than creating another post',async t=>{
  const {options,stats}=fixture(t);let creates=0,publishes=0;const media=new Map();options.send=publishPost;
  options.apiFor=platform=>({identity:async()=>({username:'indiekdotcom'}),create:async p=>{creates++;media.set(platform,{id:platform,text:p.copy,permalink:'https://social.example/'+platform,timestamp:'2026-10-22T13:00:00Z'});return {id:platform};},container:async()=> 'FINISHED',publish:async()=>{publishes++;throw new Error('lost response');},recent:async()=>[media.get(platform)]});
  assert.equal((await sharePageNow(options)).status,'held');assert.ok(options.store.posts.every(p=>p.status==='publishing'));
  assert.equal((await sharePageNow(options)).status,'published');assert.equal(creates,2);assert.equal(publishes,2);assert.equal(stats.asks,3);
});

test('account restrictions stop the request and are never routed to browser posting',async t=>{
  const {options,stats}=fixture(t);options.apiFor=()=>{throw Object.assign(new Error('API access blocked'),{pausePlatform:true});};
  await assert.rejects(sharePageNow(options),/blocked/);assert.equal(stats.sends,0);assert.equal(options.store.posts[0].pausePlatform,true);
  const calls=stats.asks;await assert.rejects(sharePageNow(options),/paused/);assert.equal(stats.asks,calls);
});

test('invalid page IDs and non-original image paths are rejected before account or filesystem access',async t=>{
  const {options,item,stats}=fixture(t);
  await assert.rejects(sharePageNow({...options,pageId:'../secret'}),/Specify/);
  item.image='/../../secret.json';await assert.rejects(sharePageNow(options),/identity/);assert.equal(stats.verifies,0);
});

test('local command forwards only maintained API workflows and propagates SSH failure',()=>{
  const config={host:'promotion-host',directory:'/srv/indiek'};
  for(const args of [['status'],['check'],['dry-run'],['story-now','a-song'],['page-now','artist','a-song','--check']]) {
    const request=remoteRequest(args,config);assert.equal(request.command,'ssh');assert.ok(request.args.includes('BatchMode=yes'));
    let ran=false;assert.equal(runRemote(args,{config,execute(command,argv,options){ran=true;assert.equal(command,'ssh');assert.deepEqual(argv,request.args);assert.equal(options.stdio,'inherit');return {status:255};}}),255);assert.ok(ran);
  }
});

test('local wrapper rejects shell payloads, credential transfer and unsafe SSH options before execution',()=>{
  const config={host:'promotion-host',directory:'/srv/indiek'};
  for(const args of [['page-now','artist','a;echo'],['page-now','artist','$(id)'],['page-now','artist','a-song','--local'],['credentials','--stdin'],['publish','threads']])assert.throws(()=>remoteRequest(args,config),/Use/);
  for(const host of ['-oProxyCommand=command','host;command','host\nother'])assert.throws(()=>remoteRequest(['check'],{...config,host}),/Configure/);
});
