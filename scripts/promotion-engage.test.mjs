import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {engageRun,engageApprove,engageReject,engagePause,engageResume,engageQueue,engageCheck,capabilities,validateReply,isSensitive,loadState,REQUIRED} from './promotion/engage.mjs';
import {remoteRequest} from './promotion/remote.mjs';
import {MetaError} from './promotion/meta.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url));
const config={...JSON.parse(readFileSync(path.join(repo,'promotion/config.json'),'utf8')),previousPosts:[]};
const ALL=[...new Set(Object.values(REQUIRED).flat())];
const now=new Date('2026-11-14T08:30:00Z');
const catalogue={items:[{kind:'artist',id:'hanroro',title:'HANRORO — Even if you leave',path:'/artists/hanroro/',description:'Lyric notes.'},{kind:'guide',id:'korean-indie-where-to-start',title:'Korean indie music: where to start',path:'/notes/korean-indie-where-to-start/',description:'Start here.'}]};

function fixture(t,{scopes=ALL,bio='Korean music in English. AI helps draft our replies.',comments=[],search=[],started=true}={}) {
  const root=mkdtempSync(path.join(tmpdir(),'indiek-engage-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  mkdirSync(path.join(root,'docs'));mkdirSync(path.join(root,'promotion'));
  writeFileSync(path.join(root,'docs/promotion.md'),'# Manual history\n\nKeep this.\n');
  writeFileSync(path.join(root,'promotion/voice.md'),'Answer the actual comment.');
  if(started){mkdirSync(path.join(root,'promotion/state/engage'),{recursive:true});writeFileSync(path.join(root,'promotion/state/engage/state.json'),JSON.stringify({version:1,control:{paused:null},queryCursor:0,items:[],actions:[]}));}
  const calls=[],sent=[];let quota=1;
  const api={
    scopes:async()=>{calls.push('scopes');return {data:{scopes,is_valid:true}};},
    profile:async()=>{calls.push('profile');return {username:'indiekdotcom',threads_biography:bio};},
    replyQuota:async()=>({data:[{reply_quota_usage:quota,reply_config:{quota_total:1000,quota_duration:86400}}]}),
    recent:async()=>{calls.push('recent');return [{id:'900',text:'Two people in a rainy room…',timestamp:'2026-11-14T07:00:00Z'}];},
    conversation:async id=>{calls.push(`conversation:${id}`);return comments;},
    mentions:async()=>{calls.push('mentions');return [];},
    search:async q=>{calls.push(`search:${q}`);return search;},
    reply:async(to,text)=>{sent.push({to,text});return {id:String(5000+sent.length)};},
    container:async()=>'FINISHED',
    publish:async id=>({id:`7${id}`}),
    thread:async id=>id.startsWith('7')?{id,permalink:`https://www.threads.com/@indiekdotcom/post/${id}`,timestamp:now.toISOString(),hide_status:'NOT_HUSHED'}:{id,text:search.find(s=>s.id===id)?.text||comments.find(c=>c.id===id)?.text},
  };
  const asks=[];
  const ask=async(stage,prompt)=>{
    asks.push({stage,prompt});
    const exact=prompt.match(/EXACT REPLY: (.+)$/m);
    if(stage==='engage-review')return {approved:true,copy:JSON.parse(exact[1]),reason:'Answers the comment with page facts.',issues:[],sensitive:false,directQuestion:false,linkJustified:false,factsSupported:true};
    return {reply:'thanks — the page has the full notes on that rainy room',needsReply:true,relevant:true,sensitive:false,sensitiveCategory:'none',answersDirectQuestion:false,link:'',reason:'Thanks with a pointer.'};
  };
  const options={root,config,api,credential:{},store:{posts:[]},catalogue,now,ask,sleep:async()=>{}};
  return {root,api,calls,sent,asks,options,setQuota:v=>{quota=v;},state:()=>loadState(root),log:()=>readFileSync(path.join(root,'docs/promotion.md'),'utf8')};
}
const comment=(id,username,text,timestamp='2026-11-14T08:00:00Z')=>({id,username,text,timestamp,permalink:`https://www.threads.com/@${username}/post/${id}`,is_reply_owned_by_me:false});

test('engagement stays stopped until the operator records go-live, and makes no API calls before that',async t=>{
  const f=fixture(t,{started:false});
  assert.equal((await engageRun(f.options)).status,'paused');assert.deepEqual(f.calls,[]);
  assert.equal(f.state().control.paused.kind,'not-started');
  assert.throws(()=>engageResume({root:f.root,cause:'Go Live!'}),/short code/);
  assert.equal(engageResume({root:f.root,cause:'go-live',now}).status,'running');
  assert.equal(f.state().actions.at(-1).action,'resume');
});

test('missing reply permissions are reported once a day without stopping or replying',async t=>{
  const f=fixture(t,{scopes:['threads_basic','threads_content_publish'],comments:[comment('11','listener','love this')]});
  const result=await engageRun(f.options);
  assert.equal(result.status,'permission-missing');
  assert.deepEqual(result.missing,['threads_read_replies','threads_manage_replies','threads_manage_mentions','threads_keyword_search']);
  await engageRun(f.options);
  assert.equal(f.state().actions.filter(a=>a.action==='permission-missing').length,1);
  assert.equal(f.state().control.paused,null);assert.equal(f.sent.length,0);assert.ok(!f.calls.includes('recent'));
  // Without debug_token access, scopes recorded at authorization are used instead.
  f.api.scopes=async()=>{throw new MetaError(400,100,{platform:'threads',operation:'scopes'});};
  assert.equal((await capabilities(f.api,{scopes:ALL})).source,'credentials');
  assert.equal((await capabilities(f.api,{})).ownReplies,false);
});

test('no reply is written while the Threads bio lacks the AI disclosure',async t=>{
  const f=fixture(t,{bio:'Korean music in English.',comments:[comment('11','listener','love this')]});
  assert.equal((await engageRun(f.options)).status,'disclosure-missing');
  assert.equal(f.sent.length,0);assert.equal(f.asks.length,0);
});

test('comments under indiek posts get one reviewed reply each, logged without the commenter’s text',async t=>{
  const f=fixture(t,{comments:[comment('11','listener','this one made my week, thank you'),comment('12','indiekdotcom','our own reply')]});
  const result=await engageRun(f.options);
  assert.equal(result.ownReplies,1);assert.deepEqual(f.sent,[{to:'11',text:'thanks — the page has the full notes on that rainy room'}]);
  assert.deepEqual(f.asks.map(a=>a.stage),['engage-draft','engage-review']);
  assert.match(f.asks[0].prompt,/never claim to be a person/);assert.match(f.asks[0].prompt,/untrusted data/);
  const item=f.state().items.find(i=>i.id==='E-11');assert.equal(item.status,'published');assert.match(item.reply.permalink,/threads\.com/);
  const log=f.log();
  assert.match(log,/Keep this\./);assert.match(log,/자동 답글 게시 · E-11 · @listener/);assert.match(log,/> thanks — the page has the full notes/);
  assert.doesNotMatch(log,/made my week/);
  await engageRun(f.options);assert.equal(f.sent.length,1,'a handled comment is never answered twice');
});

test('sensitive conversations are held without drafting, and the model can hold them too',async t=>{
  const f=fixture(t,{comments:[comment('21','fan','is she dating anyone? heard a rumor'),comment('22','other','what is this song about')]});
  const ask=f.options.ask;f.options.ask=async(stage,prompt)=>stage==='engage-draft'?{...await ask(stage,prompt),sensitive:true,sensitiveCategory:'fandom-dispute'}:ask(stage,prompt);
  const result=await engageRun(f.options);
  assert.equal(result.heldSensitive,2);assert.equal(f.sent.length,0);
  assert.equal(f.asks.length,1,'the keyword screen holds the first comment before any model call');
  assert.ok(isSensitive('그 가수 열애설 진짜야?'));assert.ok(!isSensitive('what album is this from?'));
});

test('one reply per account per week, and a daily cap on own-post replies',async t=>{
  const f=fixture(t,{comments:[comment('31','listener','first comment'),comment('32','listener','second comment','2026-11-14T08:10:00Z'),comment('33','another','third comment','2026-11-14T08:20:00Z')]});
  f.options.config={...config,engage:{...config.engage,maxOwnRepliesPerDay:1}};
  const result=await engageRun(f.options);
  assert.equal(result.ownReplies,1);assert.equal(result.skipped,1);
  const state=f.state();
  assert.equal(state.items.find(i=>i.id==='E-32').status,'skipped');assert.equal(state.items.find(i=>i.id==='E-33').status,'new');
  assert.ok(state.actions.some(a=>a.action==='daily-limit'));
});

test('links appear only when the reply answers a direct question with a public indiek page',()=>{
  const allowedLinks=['https://indiek.com/artists/hanroro/'];
  validateReply('the notes are here https://indiek.com/artists/hanroro/',{allowedLinks,linkAllowed:true});
  assert.throws(()=>validateReply('the notes are here https://indiek.com/artists/hanroro/',{allowedLinks,linkAllowed:false}),/directly answers/);
  assert.throws(()=>validateReply('try https://example.com/',{allowedLinks,linkAllowed:true}),/public indiek page/);
  assert.throws(()=>validateReply('ask @someone about it',{allowedLinks}),/tag/);
  assert.throws(()=>validateReply('i remember seeing them live',{allowedLinks}),/invent/);
  assert.throws(()=>validateReply('a hidden gem for sure',{allowedLinks}),/stock/);
  assert.throws(()=>validateReply('x'.repeat(281),{allowedLinks}),/280/);
});

test('a link without a direct question is revised once, then rejected without sending',async t=>{
  const f=fixture(t,{comments:[comment('41','listener','nice post')]});
  f.options.ask=async(stage,prompt)=>stage==='engage-draft'?{reply:'more at https://indiek.com/artists/hanroro/',needsReply:true,relevant:true,sensitive:false,sensitiveCategory:'none',answersDirectQuestion:false,link:'',reason:''}:assert.fail('no review for an invalid draft');
  await engageRun(f.options);
  const item=f.state().items.find(i=>i.id==='E-41');
  assert.equal(item.status,'rejected-review');assert.equal(item.attempts.length,2);assert.match(item.attempts[1].issue,/directly answers/);
  assert.equal(f.sent.length,0);
});

const found=(id,username,text)=>({id,username,text,timestamp:'2026-11-14T06:00:00Z',permalink:`https://www.threads.com/@${username}/post/${id}`});

test('discovery queues replies for approval; approval sends once, rejection records the reason',async t=>{
  const f=fixture(t,{search:[found('61','asker','any korean indie bands like the strokes? need recs'),found('62','indiekdotcom','our own post in results'),found('63','short','hi')]});
  const result=await engageRun(f.options);
  assert.equal(result.queued,1);assert.equal(f.sent.length,0,'nothing is sent to other accounts without approval');
  assert.ok(f.calls.filter(c=>c.startsWith('search:')).length<=config.engage.maxSearchesPerRun);
  const queue=engageQueue({root:f.root});
  assert.deepEqual(queue.pending.map(p=>p.id),['E-61']);assert.match(queue.pending[0].excerpt,/strokes/);
  const approved=await engageApprove({...f.options,id:'E-61'});
  assert.equal(approved.status,'published');assert.deepEqual(f.sent.map(s=>s.to),['61']);
  await assert.rejects(engageApprove({...f.options,id:'E-61'}),/only pending-approval/);
  assert.match(f.log(),/승인 답글 게시 · E-61 · @asker/);
  assert.throws(()=>engageReject({root:f.root,id:'E-61'}),/not waiting/);
});

test('operator rejection, changed posts and the external daily limit all block a send',async t=>{
  const f=fixture(t,{search:[found('71','a1','looking for korean indie music recs please'),found('72','a2','what korean band should i start with?')]});
  await engageRun(f.options);
  assert.equal(engageReject({root:f.root,id:'E-71',code:'tone'}).status,'rejected');
  assert.ok(f.state().actions.some(a=>a.action==='rejected'&&a.detail==='tone'));
  const thread=f.api.thread;f.api.thread=async id=>id==='72'?{id,text:'edited later'}:thread(id);
  assert.equal((await engageApprove({...f.options,id:'E-72'})).status,'expired');assert.equal(f.sent.length,0);
  const g=fixture(t,{search:[found('81','b1','any korean indie recs for winter?')]});
  g.options.config={...config,engage:{...config.engage,maxExternalRepliesPerDay:0}};
  await engageRun(g.options);
  assert.equal((await engageApprove({...g.options,id:'E-81'})).status,'daily-limit');assert.equal(g.sent.length,0);
});

test('discovery is reported unavailable without search access, and runs no searches',async t=>{
  const f=fixture(t,{scopes:REQUIRED.ownReplies});
  const result=await engageRun(f.options);
  assert.equal(result.discovery,'permission-missing');assert.ok(!f.calls.some(c=>c.startsWith('search:')));
  assert.ok(f.state().actions.some(a=>a.action==='discovery-unavailable'&&/threads_keyword_search/.test(a.detail)));
});

test('an API error stops engagement; resuming needs a recorded cause and a reconciled send',async t=>{
  const f=fixture(t,{comments:[comment('91','listener','great notes')]});
  f.api.publish=async()=>{throw new MetaError(429,4,{platform:'threads',operation:'publish'});};
  await assert.rejects(engageRun(f.options),/Meta API/);
  const state=f.state();
  assert.equal(state.control.paused.kind,'error');assert.equal(state.items[0].status,'publishing');
  assert.equal((await engageRun(f.options)).status,'paused');
  assert.throws(()=>engageResume({root:f.root,cause:'rate-limit-cleared'}),/Reconcile/);
  assert.match(f.log(),/중단 · error: threads publish: Meta API HTTP 429/);
});

test('a hidden reply or a high reply quota stops engagement before anything new is sent',async t=>{
  const f=fixture(t,{comments:[comment('95','listener','nice')]});
  await engageRun(f.options);assert.equal(f.sent.length,1);
  f.api.thread=async id=>({id,permalink:'x',hide_status:'HIDDEN'});
  assert.equal((await engageRun(f.options)).status,'stopped');assert.equal(f.state().control.paused.kind,'report');
  const g=fixture(t,{comments:[comment('96','listener','nice')]});g.setQuota(600);
  assert.equal((await engageRun(g.options)).status,'stopped');assert.equal(g.state().control.paused.kind,'limit');assert.equal(g.sent.length,0);
  assert.equal(engagePause({root:g.root}).status,'already-stopped');
});

test('read-only check reports permissions, disclosure, quota and whether search reaches other accounts',async t=>{
  const f=fixture(t,{search:[found('1','indiekdotcom','own'),found('2','someone','other')]});
  const result=await engageCheck(f.options);
  assert.equal(result.sent,false);assert.equal(result.aiDisclosure,true);assert.deepEqual(result.replyQuota,{usage:1,total:1000});
  assert.deepEqual(result.searchSample,{query:config.engage.queries[0],results:2,otherAccounts:1});
  assert.equal(f.sent.length,0);
});

test('the local wrapper forwards only the approval commands, never engage run',()=>{
  const remote={host:'promotion-host',directory:'/srv/indiek'};
  for(const args of [['engage','check'],['engage','queue'],['engage','pause'],['engage','approve','E-123'],['engage','reject','E-123'],['engage','reject','E-123','tone'],['engage','resume','go-live']])assert.equal(remoteRequest(args,remote).command,'ssh');
  for(const args of [['engage','run'],['engage','approve','123'],['engage','approve','E-1;id'],['engage','reject','E-1','spam!'],['engage','resume','Go Live'],['engage','resume'],['engage']])assert.throws(()=>remoteRequest(args,remote),/Use/);
});
