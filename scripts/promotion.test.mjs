import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store,slots,eligible,hash,validateDraft,validatePost,verifyLive,publishPost,withLock} from './promotion/core.mjs';
import {metaClient,refreshToken,MetaError} from './promotion/meta.mjs';
const config={origin:'https://indiek.com',platforms:['threads','instagram'],account:'indiekdotcom',maxSlotAgeMinutes:120,cooldownDays:28,previousPosts:[]};
const now=new Date('2026-10-20T01:00:00Z');
function post(platform='threads'){
 const p={id:`${platform==='threads'?'T':'I'}-2026-10-20-1000`,platform,scheduledAt:now.toISOString(),status:'ready',url:`https://indiek.com/artists/ydbb/?from=${platform}`,imageUrl:'https://indiek.com/assets/social/artists-ydbb.jpg',altText:'YdBB — ONCE, indiek listening notes.',copy:`a song to start with\n\nhttps://indiek.com/artists/ydbb/?from=${platform}`,sourceDescription:'A farewell.',artistIds:['ydbb']};p.payloadHash=hash([p.platform,p.url,p.imageUrl,p.copy,p.altText]);return p;
}
function fixture(){
 const events=[],remote=[];let sends=0,creates=0;
 const store={save(p,event){events.push({status:p.status,event});}};
 const api={identity:async()=>({username:'indiekdotcom'}),create:async()=>{creates++;return{id:'container'};},container:async()=>'FINISHED',publish:async()=>{sends++;return{id:'posted'};},media:async()=>remote[0],recent:async()=>remote};
 return {events,remote,api,store,sends:()=>sends,creates:()=>creates,options:{config,api,store,now,verify:async()=>{},sleep:async()=>{}}};
}
test('schedule uses KST while server is UTC and skips elapsed slots',()=>{
 const next=slots(new Date('2026-10-19T08:00:00Z'));
 assert.deepEqual(next.map(s=>s.scheduledAt),['2026-10-20T01:00:00.000Z','2026-10-23T01:00:00.000Z','2026-10-23T01:15:00.000Z']);
 assert.equal(slots(new Date('2026-10-23T01:10:00Z')).length,1);
});
test('artist cooldown covers earlier manual posts and newly prepared slots',()=>{
 const items=[{id:'a',artistIds:['a']},{id:'b',artistIds:['b']}];
 assert.deepEqual(eligible(items,[{scheduledAt:now.toISOString(),artistIds:['a'],status:'ready'}],{scheduledAt:now.toISOString()},config).map(x=>x.id),['b']);
});
test('copy and payload validation reject ungrounded excerpts, changed copy and external destinations',()=>{
 validateDraft('a short song introduction for tonight',['A farewell.'],'A farewell.','threads');
 assert.throws(()=>validateDraft('a short song introduction for tonight',['Invented fact'],'A farewell.','threads'),/excerpts/);
 assert.throws(()=>validateDraft('i watched this live last night',['A farewell.'],'A farewell.','threads'),/history/);
 const p=post();validatePost(p,config);p.copy+=' changed';assert.throws(()=>validatePost(p,config),/changed/);
 p.url='https://example.com/';assert.throws(()=>validatePost(p,config),/selected indiek/);
});
test('publishing twice sends once, records the exact-copy state before sending, and verifies the result',async()=>{
 const p=post(),f=fixture();f.remote.push({id:'posted',text:p.copy,permalink:'https://www.threads.com/@indiekdotcom/post/test',timestamp:now.toISOString()});
 f.api.publish=async()=>{assert.equal(f.events.at(-1).status,'publishing');return{id:'posted'};};
 let calls=0;const send=f.api.publish;f.api.publish=async()=>{calls++;return send();};
 await publishPost(p,f.options);await publishPost(p,f.options);
 assert.equal(calls,1);assert.equal(p.status,'published');assert.ok(p.permalink);
});
test('a timeout after a successful send reconciles remotely without sending twice',async()=>{
 const p=post(),f=fixture();let sends=0;
 f.api.publish=async()=>{sends++;f.remote.push({id:'posted',text:p.copy,permalink:'https://www.threads.com/@indiekdotcom/post/test',timestamp:now.toISOString()});throw new Error('timeout');};
 await publishPost(p,f.options);assert.equal(p.status,'publishing');
 await publishPost(p,f.options);assert.equal(p.status,'published');assert.equal(sends,1);
});
test('an uncertain send stays unresolved even if no recent post is found',async()=>{
 const p=post(),f=fixture();f.api.publish=async()=>{throw new Error('timeout');};
 await publishPost(p,f.options);await publishPost(p,f.options);
 assert.equal(p.status,'publishing');assert.equal(f.creates(),1);assert.match(p.issue,/불확실/);
});
test('unpublished sources, wrong accounts and expired slots cannot publish',async()=>{
 const p=post(),f=fixture();
 await assert.rejects(publishPost(p,{...f.options,verify:async()=>{throw new Error('not public');}}),/not public/);
 f.api.identity=async()=>({username:'wrong-account'});await assert.rejects(publishPost(p,f.options),/account/);
 const late=post();await publishPost(late,{...f.options,now:new Date(now.getTime()+3*3600000)});
 assert.equal(late.status,'expired');assert.equal(f.creates(),0);
});
test('rate limiting pauses the platform; one platform failure does not re-send a successful other post',async()=>{
 const p=post(),f=fixture();f.api.create=async()=>{throw new MetaError(429,4);};
 await publishPost(p,f.options);assert.equal(p.status,'held');assert.equal(p.pausePlatform,true);
 const other=post('instagram'),g=fixture();g.remote.push({id:'posted',caption:other.copy,permalink:'https://www.instagram.com/p/test/',timestamp:now.toISOString()});
 await publishPost(other,g.options);assert.equal(other.status,'published');await publishPost(other,g.options);assert.equal(g.sends(),1);
});
test('verification and container processing cannot carry an unsent job past its delivery deadline',async()=>{
 const late=new Date(now.getTime()+119*60000);
 let elapsed=0;
 const first=post(),f=fixture();f.api.identity=async()=>assert.fail('deadline must be checked before any API call');
 await publishPost(first,{...f.options,now:late,clock:()=>elapsed,verify:async()=>{elapsed+=61000;}});
 assert.equal(first.status,'expired');assert.equal(f.creates(),0);
 elapsed=0;
 const second=post(),g=fixture();g.api.container=async()=>{elapsed+=61000;return 'FINISHED';};
 await publishPost(second,{...g.options,now:late,clock:()=>elapsed});
 assert.equal(second.status,'expired');assert.equal(g.creates(),1);assert.equal(g.sends(),0);
});
test('journal survives restart and keeps manual entries, immutable copy and permalink',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'indiek-promotion-'));mkdirSync(path.join(root,'docs'));writeFileSync(path.join(root,'docs/promotion.md'),'# Existing manual entries\n\nT001 preserved.\n');
 try{const store=new Store(root),p=post();store.save(p,'prepared');p.status='published';p.permalink='https://www.threads.com/post/test';store.save(p,'verified');
 const restored=new Store(root);assert.equal(restored.posts[0].status,'published');restored.log();
 const log=readFileSync(path.join(root,'docs/promotion.md'),'utf8');assert.match(log,/T001 preserved/);assert.match(log,/a song to start with/);assert.match(log,/https:\/\/www.threads.com\/post\/test/);assert.equal(log.split('### T-').length,2);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('concurrent runners cannot modify the same queue',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'indiek-lock-'));
 try{await withLock(dir,async()=>{await assert.rejects(withLock(dir,async()=>{}),/Another/);});await withLock(dir,async()=>{});}finally{rmSync(dir,{recursive:true,force:true});}
});
test('API adapters keep tokens out of URL and use documented versioned endpoints',async()=>{
 const calls=[];const fetcher=async(url,options)=>{calls.push({url:String(url),options});return new Response(JSON.stringify({id:'123',status:'FINISHED',status_code:'FINISHED'}),{status:200});};
 for(const platform of ['threads','instagram']){
 const api=metaClient(platform,{token:'secret-token',userId:'123'},{fetcher});await api.create(post(platform));await api.publish('456');await api.container('456');
 }
 assert.ok(calls.every(c=>!c.url.includes('secret-token')));assert.match(calls[0].url,/graph\.threads\.com\/v1\.0\/123\/threads$/);
 assert.match(calls[3].url,/graph\.instagram\.com\/v26\.0\/123\/media$/);assert.ok(calls[3].options.body.get('alt_text'));
});
test('public verification requires a canonical page, matching source and a public JPEG',async()=>{
 const p=post();const fetcher=async(url,options)=> options?.method==='HEAD'?new Response('',{status:404}):new Response('<link href="https://indiek.com/artists/ydbb/">A farewell.',{headers:{'content-type':'text/html'}});
 await assert.rejects(verifyLive(p,fetcher),/image is not public/);
});
test('expired tokens stop without refresh or publishing, refresh values are never logged',async()=>{
 await assert.rejects(refreshToken('threads',{token:'secret',expiresAt:'2026-10-01',issuedAt:'2026-09-01'},async()=>{throw new Error('must not request');},now),/expired/);
 const c={token:'old',expiresAt:'2026-10-21',issuedAt:'2026-09-01'};
 await refreshToken('threads',c,async()=>new Response(JSON.stringify({access_token:'new',expires_in:5000000})),now);assert.equal(c.token,'new');
});
