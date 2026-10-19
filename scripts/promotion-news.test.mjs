import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store,hash,payloadParts,validatePost,publishPost} from './promotion/core.mjs';
import {metaClient,recentOwnPosts} from './promotion/meta.mjs';
import {dailySlots,artistsForResearch,validateCoverage,validateCandidate,verifyCandidate,duplicateNews,eventKey,rankNews,selectedMedia,globalAddress,publicURL,publicRequest,validateNewsVoice,supersedeStaticJobs} from './promotion/news.mjs';
import {prepareDaily,reviewBeforePublish,reviewPass,mergeHistory} from './promotion/news-runner.mjs';

const now=new Date('2026-10-20T00:00:00Z');
const config={origin:'https://indiek.com',account:'indiekdotcom',platforms:['threads','instagram'],previousPosts:[],maxSlotAgeMinutes:120,news:{maxAgeDays:14,upcomingDays:30,researchTimeoutSeconds:420,maxReviewCandidates:3}};
const artists=[{id:'a',name:'Artist A'},{id:'b',name:'Artist B'}];
function candidate(overrides={}){
  return {artistId:'a',kind:'concert',subject:'Autumn Hall show',headline:'Artist A at Autumn Hall',summary:'Artist A plays Autumn Hall in Tokyo on October 30.',dateBasis:'publication',publishedAt:'2026-10-19',eventDate:'2026-10-30',timezone:'Asia/Tokyo',source:{url:'https://venue.example/shows/artist-a',publisher:'Autumn Hall',relationship:'venue',quote:'Artist A plays Autumn Hall in Tokyo on October 30.',dateEvidence:'Published October 19, 2026',affiliationUrl:'https://venue.example/about',affiliationQuote:'Autumn Hall is a music venue in Tokyo.'},relevance:3,actionability:2,selectionReason:'Upcoming show has a specific city and date for listeners in Japan.',draft:'Artist A plays Autumn Hall in Tokyo on October 30',...overrides};
}
const coverage=artists.map(artist=>({artistId:artist.id,status:'checked',urls:['https://venue.example/shows/artist-a'],note:'Checked primary venue listings.'}));
const request=async url=>({url:String(url),headers:{'content-type':'text/html'},body:'<main>Artist A plays Autumn Hall in Tokyo on October 30. Published October 19, 2026 Autumn Hall is a music venue in Tokyo.</main>'});
function approved(c=candidate()){
  return {approved:true,reason:'Primary venue and exact date confirmed; concise factual wording.',sourceIsPrimary:true,datesConfirmed:true,factsConfirmed:true,noDuplicate:true,voicePassed:true,checkedURLs:[c.source.url,c.source.affiliationUrl],supportedClaims:[{claim:c.draft,sourceURL:c.source.url,quote:c.source.quote}],unsupportedClaims:[],styleIssues:[]};
}
function fixture(){
  const root=mkdtempSync(path.join(tmpdir(),'indiek-news-test-'));
  for(const directory of ['docs','promotion','content'])mkdirSync(path.join(root,directory));
  writeFileSync(path.join(root,'docs/promotion.md'),'# Manual history\n\nKeep existing entries.\n');
  writeFileSync(path.join(root,'promotion/voice.md'),'Use concrete facts, no invented experience or stock praise.');
  writeFileSync(path.join(root,'promotion/media.json'),'[]');
  writeFileSync(path.join(root,'content/catalogue.json'),JSON.stringify({records:[{id:'a',artist:'Artist A',artistSource:'https://venue.example/about'}],editorPick:{id:'b',artist:'Artist B',artistSource:'https://venue.example/about'}}));
  const catalogue={origin:config.origin,items:artists.map(artist=>({id:artist.id,kind:'artist',artistIds:[artist.id]}))};
  const store=new Store(root),calls=[];
  const ask=async(stage,prompt)=>{calls.push({stage,prompt});return stage==='research'?{coverage,candidates:[candidate()]}:approved();};
  return {root,catalogue,store,calls,ask,cleanup:()=>rmSync(root,{recursive:true,force:true})};
}
test('daily KST preparation selects one day and never fills elapsed slots',()=>{
  assert.deepEqual(dailySlots(now).map(slot=>slot.scheduledAt),['2026-10-20T01:00:00.000Z','2026-10-20T01:15:00.000Z']);
  assert.equal(dailySlots(new Date('2026-10-20T01:00:00Z'))[0].scheduledAt,'2026-10-21T01:00:00.000Z');
  assert.equal(dailySlots(new Date('2026-10-31T23:00:00Z'))[0].id,'T-2026-11-01-1000-news');
});
test('research includes Editor’s pick and new artists; missing catalogue entries or coverage block the day',()=>{
  const f=fixture();
  try{
    const content=JSON.parse(readFileSync(path.join(f.root,'content/catalogue.json')));
    assert.deepEqual(artistsForResearch(f.catalogue,content).map(a=>a.id),['a','b']);
    f.catalogue.items.push({id:'new-artist',kind:'artist',artistIds:['new-artist']});
    assert.throws(()=>artistsForResearch(f.catalogue,content),/missing/);
    assert.throws(()=>validateCoverage({coverage:coverage.slice(0,1)},artists),/every/);
    assert.throws(()=>validateCoverage({coverage:[coverage[0],{...coverage[1],urls:[]}]},artists),/coverage/);
  }finally{f.cleanup();}
});
test('stale announcements, fabricated publication dates and passed concerts are rejected; current dated listings are distinct',()=>{
  validateCandidate(candidate(),artists,config,now);
  for(const change of [{publishedAt:'2026-09-01'},{publishedAt:'2026-10-21'},{publishedAt:''},{eventDate:'2026-10-19'},{eventDate:'2026-02-30'}])assert.throws(()=>validateCandidate(candidate(change),artists,config,now));
  validateCandidate(candidate({dateBasis:'current-event-listing',publishedAt:''}),artists,config,now);
  assert.throws(()=>validateCandidate(candidate({dateBasis:'current-event-listing',publishedAt:'2026-10-20'}),artists,config,now));
  assert.throws(()=>validateCandidate(candidate({dateBasis:'current-event-listing',publishedAt:'',eventDate:'2026-12-01'}),artists,config,now));
});
test('public-source checks fail on private destinations and verify actual source facts and dates',async()=>{
  for(const address of ['127.0.0.1','10.0.0.2','100.64.0.1','169.254.169.254','172.16.0.1','192.168.1.1','::1','::ffff:127.0.0.1','2001:db8::1'])assert.equal(globalAddress(address),false,address);
  assert.equal(globalAddress('8.8.8.8'),true);assert.equal(globalAddress('2606:4700:4700::1111'),true);
  for(const url of ['http://venue.example','https://user:password@venue.example','https://localhost/a','https://venue.local/a'])assert.throws(()=>publicURL(url));
  await assert.rejects(publicRequest('https://venue.example',{lookup:async()=>[{address:'127.0.0.1',family:4}]}),/non-public/);
  await verifyCandidate(candidate(),{request});
  await assert.rejects(verifyCandidate(candidate({source:{...candidate().source,dateEvidence:'An invented primary date'}}),{request}),/date/);
});
test('event identity and canonical source dedupe survive tracking and headline changes without banning new artist news',()=>{
  const c=candidate(),posts=[{kind:'news',status:'published',news:c,topicKey:eventKey(c),artistIds:['a'],publishedAt:now.toISOString()}];
  assert.equal(duplicateNews(candidate({headline:'Completely different headline'}),posts),true);
  assert.equal(duplicateNews(candidate({subject:'translated event',source:{...c.source,url:c.source.url+'?utm_source=test'}}),posts),true);
  const next=candidate({subject:'Winter tour',eventDate:'2026-11-05',source:{...c.source,url:'https://venue.example/winter'}});
  assert.equal(duplicateNews(next,posts),false);
  const b=candidate({artistId:'b'});
  assert.equal(rankNews([c,b],posts,now)[0].artistId,'b');
});
test('daily preparation creates one reviewed text post, records missing image, and a restart does not research or send twice',async()=>{
  const f=fixture();
  try{
    const result=await prepareDaily({...f,config,now,request});
    assert.equal(result.status,'prepared');assert.equal(f.store.posts.length,1);
    const post=f.store.posts[0];assert.equal(post.platform,'threads');assert.equal(post.imageUrl,null);validatePost(post,config);
    assert.equal(f.calls.length,2);assert.ok(f.calls.every(call=>call.prompt.includes('Use concrete facts')));
    const resumed=await prepareDaily({...f,config,now,request});assert.equal(resumed.status,'already-prepared');assert.equal(f.calls.length,2);
    const log=readFileSync(path.join(f.root,'docs/promotion.md'),'utf8');assert.match(log,/Keep existing entries/);assert.match(log,/no rights-cleared image/);assert.match(log,/b: checked/);
    post.news.summary+=' Changed fact';assert.throws(()=>validatePost(post,config),/changed/);
  }finally{f.cleanup();}
});
test('official account history is identity-checked and only public post fields reach copy review',async()=>{
  const calls=[];
  const recent=await recentOwnPosts(config,{threads:{token:'private-token'},instagram:{token:'another-private-token'}},{client:platform=>({
    identity:async()=>{calls.push(`${platform}:identity`);return {username:'indiekdotcom'};},
    recent:async()=>{assert.ok(calls.includes(`${platform}:identity`));return [{id:`${platform}-post`,text:platform==='threads'?'earlier Threads wording':undefined,caption:'earlier Instagram wording',permalink:`https://social.example/${platform}`,timestamp:'2026-10-19T01:00:00Z',access_token:'never-copy-this',private_metadata:{token:'private'}}];}
  })});
  assert.equal(recent.length,2);assert.equal(recent[0].copy,'earlier Threads wording');assert.equal(recent[1].copy,'earlier Instagram wording');
  assert.deepEqual(Object.keys(recent[0]).sort(),['copy','id','permalink','platform','publishedAt']);assert.doesNotMatch(JSON.stringify(recent),/private|never-copy/);
  await assert.rejects(recentOwnPosts(config,{threads:{token:'private-token'}},{client:()=>({identity:async()=>({username:'wrong-account'}),recent:async()=>assert.fail('wrong account history must not be fetched')})}),/does not match/);
});
test('API text replaces permalink-matched placeholders while retaining known artist and event metadata',()=>{
  const previous=[{id:'T001',platform:'threads',artistIds:['a'],permalink:'https://www.threads.com/@indiekdotcom/post/old',publishedAt:'2026-10-19',copy:'outdated recorded copy'}];
  const recent=[{id:'remote-post',platform:'threads',permalink:'https://www.threads.net/@indiekdotcom/post/old/',publishedAt:'2026-10-19T01:00:00Z',copy:'actual API-verified current wording'}];
  const history=mergeHistory(previous,[],recent);
  assert.equal(history.length,1);assert.equal(history[0].copy,recent[0].copy);assert.deepEqual(history[0].artistIds,['a']);assert.equal(history[0].historySource,'identity-verified account API');
});
test('prepare and send-time reviewers see the exact final caption, supplied API text and the cross-platform companion rule',async()=>{
  const f=fixture();
  const recentPosts=[{platform:'threads',id:'earlier',copy:'an actual earlier song introduction',permalink:'https://www.threads.com/@indiekdotcom/post/earlier',publishedAt:'2026-10-19T01:00:00Z'}];
  const captured=[];
  const ask=async(stage,prompt)=>{
    captured.push({stage,prompt});
    if(stage==='research')return {coverage,candidates:[candidate()]};
    assert.ok(prompt.includes(`FINAL EXACT CAPTION:\n${candidate().draft}\n\n${candidate().source.url}`));
    assert.match(prompt,/an actual earlier song introduction/);assert.match(prompt,/Do NOT open indiekdotcom social profiles/);assert.match(prompt,/OTHER platform is allowed/);
    return approved();
  };
  try{
    await prepareDaily({...f,config,now,request,recentPosts,ask});
    const thread=f.store.posts[0];
    const instagram={...thread,id:thread.id.replace(/^T-/,'I-').replace('1000-news','1015-news'),platform:'instagram',media:{topicKey:thread.topicKey,url:'https://indiek.com/assets/social/event.jpg',provenanceURL:'https://venue.example/permission',rights:'permission',rightsNote:'Written venue permission.',approvedBy:'owner',approvedAt:'2026-10-19',altText:'Artist A concert'},imageUrl:'https://indiek.com/assets/social/event.jpg',altText:'Artist A concert'};
    instagram.payloadHash=hash(payloadParts(instagram));
    await reviewBeforePublish(instagram,{root:f.root,config,posts:[thread,instagram],recentPosts,now,request:async(url,options)=>options?.method==='HEAD'?{url,headers:{'content-type':'image/jpeg'}}:request(url),ask});
    const finalPrompt=captured.at(-1).prompt;assert.match(finalPrompt,/indiekdotcom instagram post/);assert.match(finalPrompt,/"platform":"threads"/);
    assert.doesNotMatch(finalPrompt, new RegExp(`"id":"${instagram.id}"`));
  }finally{f.cleanup();}
});
test('review evidence accepts verified affiliation facts only at their actual source URL',async()=>{
  const c=candidate();
  const verification=await verifyCandidate(c,{request:async url=>({url,headers:{'content-type':'text/html'},body:url===c.source.url?`${c.source.quote} ${c.source.dateEvidence}`:c.source.affiliationQuote})});
  const review=approved(c);review.supportedClaims.push({claim:'Autumn Hall is the venue.',sourceURL:c.source.affiliationUrl,quote:c.source.affiliationQuote});
  reviewPass(review,c,verification);
  review.supportedClaims[1].sourceURL=c.source.url;assert.throws(()=>reviewPass(review,c,verification),/verified evidence/);
  review.supportedClaims[1].sourceURL='https://unverified.example/claim';assert.throws(()=>reviewPass(review,c,verification),/verified evidence/);
});
test('a day without approved evidence logs an honest skip and never falls back to made-up or static news',async()=>{
  const f=fixture();
  try{
    const result=await prepareDaily({...f,config,now,request,ask:async stage=>stage==='research'?{coverage,candidates:[candidate()]}:{...approved(),approved:false,reason:'Original source is ambiguous.'}});
    assert.equal(result.status,'skipped');assert.equal(f.store.posts.length,0);assert.match(result.reason,/ambiguous/);
    assert.match(readFileSync(path.join(f.root,'docs/promotion.md'),'utf8'),/no approved daily topic/);
  }finally{f.cleanup();}
});
test('recomputing the payload hash cannot substitute a caption that the independent review did not see',async()=>{
  const f=fixture();
  try{
    await prepareDaily({...f,config,now,request});
    const post=f.store.posts[0];
    post.copy=`Artist A has cancelled the Tokyo show\n\n${post.url}`;
    post.payloadHash=hash(payloadParts(post));
    assert.throws(()=>validatePost(post,config),/Invalid final news caption/);
    await assert.rejects(publishPost(post,{config,store:f.store,api:{identity:async()=>assert.fail('unreviewed copy must not reach the API')},now:new Date(post.scheduledAt),verify:async()=>assert.fail('unreviewed copy must fail before verification')}),/Invalid final news caption/);
  }finally{f.cleanup();}
});
test('an evening skip may be researched again the next morning for the same upcoming slot',async()=>{
  const f=fixture();let researches=0;
  const ask=async stage=>{assert.equal(stage,'research');researches++;return {coverage,candidates:[]};};
  try{
    const evening=new Date('2026-10-19T12:00:00Z');
    await prepareDaily({...f,config,now:evening,request,ask});
    await prepareDaily({...f,config,now:new Date('2026-10-19T13:00:00Z'),request,ask});
    assert.equal(researches,1);
    await prepareDaily({...f,config,now,request,ask});assert.equal(researches,2);
    assert.equal(f.store.posts.length,0);
  }finally{f.cleanup();}
});
test('Instagram requires topic-specific explicit permission and a public JPEG',async()=>{
  const f=fixture(),c=candidate();
  const media={topicKey:eventKey(c),url:'https://indiek.com/assets/social/approved-event.jpg',provenanceURL:'https://venue.example/permission',rights:'permission',rightsNote:'Venue gave written social reuse permission.',approvedBy:'owner',approvedAt:'2026-10-19',altText:'Artist A at Autumn Hall, Tokyo, October 30.'};
  try{
    assert.throws(()=>selectedMedia(c,[{...media,rights:'public'}],now),/permission/);
    assert.equal(selectedMedia(c,[{...media,topicKey:'another event'}],now),null);
    writeFileSync(path.join(f.root,'promotion/media.json'),JSON.stringify([media]));
    await prepareDaily({...f,config,now,request:async(url,options)=>options?.method==='HEAD'?{url,headers:{'content-type':'image/jpeg'}}:request(url)});
    assert.equal(f.store.posts.length,2);assert.equal(f.store.posts[1].topicKey,f.store.posts[0].topicKey);assert.equal(f.store.posts[1].platform,'instagram');validatePost(f.store.posts[1],config);
  }finally{f.cleanup();}
});
test('live review runs again before sending and rejection stops delivery after a cancellation',async()=>{
  const f=fixture();
  try{
    await prepareDaily({...f,config,now,request});const post=f.store.posts[0];
    const verify=p=>reviewBeforePublish(p,{root:f.root,config,posts:f.store.posts,now,request,ask:async()=>({...approved(),approved:false,datesConfirmed:false,reason:'The show is now cancelled.'})});
    await assert.rejects(publishPost(post,{config,store:f.store,api:{identity:async()=>assert.fail('must not reach the API')},now:new Date(post.scheduledAt),verify}),/cancelled/);
    assert.equal(post.status,'ready');assert.equal(post.containerId,undefined);
  }finally{f.cleanup();}
});
test('TEXT containers keep separate create and publish operations, with no image or auto-publish parameter',async()=>{
  const calls=[];const api=metaClient('threads',{token:'secret',userId:'123'},{fetcher:async(url,options)=>{calls.push({url:String(url),options});return new Response('{"id":"container"}');}});
  await api.create({kind:'news',copy:'Artist A has a show in Tokyo',url:'https://venue.example/show'});
  const body=calls[0].options.body;assert.equal(body.get('media_type'),'TEXT');assert.equal(body.get('link_attachment'),'https://venue.example/show');assert.equal(body.has('auto_publish_text'),false);assert.equal(body.has('image_url'),false);assert.equal(calls.length,1);
});
test('static migration preserves attempted and published jobs; stock praise and fabricated memories do not pass style checks',()=>{
  const posts=[{id:'future',status:'ready',scheduledAt:'2026-10-21T01:00:00Z'},{id:'inflight',status:'publishing',scheduledAt:'2026-10-21T01:00:00Z'},{id:'published',status:'published',scheduledAt:'2026-10-21T01:00:00Z'},{id:'container',status:'ready',containerId:'c',scheduledAt:'2026-10-21T01:00:00Z'}];
  supersedeStaticJobs({posts,save:()=>{}},now);assert.deepEqual(posts.map(post=>post.status),['superseded','publishing','published','ready']);
  for(const copy of ['a hidden gem you need to listen to tonight','i watched this live in Seoul last year','✨ Artist A has another wonderful announcement'])assert.throws(()=>validateNewsVoice(copy));
  validateNewsVoice('Artist A plays Autumn Hall in Tokyo on October 30');
});
