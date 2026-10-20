import test from 'node:test';
import assert from 'node:assert/strict';
import {publicStories,storyIndex,searchStories} from '../site/stories.mjs';
import {navigationSection} from '../site/shared.mjs';
import {validateStory,storyDigest,skillRevision} from './editorial/content.mjs';
import {due,prepareIssue,approval} from './editorial/workflow.mjs';
import {assertChanges,verifyPublished,publishIssue} from './editorial/publisher.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {verifyClaims} from './editorial/ai.mjs';
import {storyCandidate,prepareStory} from './promotion/stories.mjs';
import {validatePost,payloadParts,hash,verifyLive} from './promotion/core.mjs';
import {storyViews} from './story-pages.mjs';

const config={weekdays:[2,5],startHour:3,maxTopics:3,maxVersionsPerTopic:4,deadlineSeconds:10800,maxWeeklyPublications:2};
const now=new Date('2026-10-20T03:00:00+09:00');
const source={id:'a',url:'https://example.com/interview',label:'Original interview',publisher:'Writer',checked:'2026-10-20'};
const story=()=>({id:'a-song',slug:'a-song',status:'draft',category:'Song stories',title:'A <song>',description:'A & B',authorId:'indiek',published:'2026-10-20',updated:'2026-10-20',artistIds:[],keywords:['선우정아'],sources:[source],blocks:[{type:'paragraph',text:'An attributed statement.',sources:['a']}]});
const authors=[{id:'indiek',type:'Organization',name:'indiek',url:'/about/'}],tracks=[];
const good=()=>({facts:{approved:true,issues:[],reason:'Original checked',checkedURLs:[source.url],supportedClaims:[{sourceURL:source.url,claim:'A statement',evidence:'original evidence'}]},editorial:{approved:true,issues:[],reason:'Specific contribution',contribution:'Connects two accounts',referenceIds:['ref'],comparisons:['No copied sequence']}});
test('drafts and future publications do not enter public discovery, but published stories are searchable',()=>{
  const a={...story(),status:'published'},b={...a,id:'future',published:'2099-01-01'};
  const visible=publicStories([story(),a,b],now);
  assert.equal(visible.length,1);assert.equal(searchStories(storyIndex(visible),'선우정아')[0].id,a.id);
  assert.equal(navigationSection('/stories/a-song/'),'stories');
});
test('every material article edit invalidates reviews; publication status alone does not',()=>{
  const s=story(),g=good();s.review=approval(g.facts,g.editorial,s,'revision',now);
  validateStory(s,{authors,tracks,approved:true});s.status='published';
  validateStory(s,{authors,tracks,approved:true});s.description='A changed claim';
  assert.throws(()=>validateStory(s,{authors,tracks,approved:true}),/changed/);
});
test('rendered articles escape text, attribute sources and keep one shared-player trigger',()=>{
  const s=story();s.blocks.push({type:'listen',trackId:'known',sources:[]});
  const t={id:'known',track:'A song',artist:'Artist',videoType:'live'};
  const html=storyViews({stories:[s],authors,media:{},tracks:[t],pick:t}).article(s);
  assert.ok(html.includes('A &lt;song&gt;'));assert.ok(!html.includes('<iframe'));assert.equal((html.match(/data-load-player=/g)||[]).length,1);
  assert.ok(html.includes('AI-assisted'));assert.ok(html.includes('id="source-a"'));
});
test('daily and rolling-week limits include manually released stories and allow next-day deferral',()=>{
  assert.equal(due({},[],config,now),true);
  assert.equal(due({},[{...story(),status:'published'}],config,now),false);
  const past=['2026-10-16','2026-10-18'].map(p=>({...story(),status:'published',published:p}));
  assert.equal(due({},past,config,now),false);
  const wed=new Date('2026-10-21T03:00:00+09:00');
  assert.equal(due({},[],config,wed),false);
  assert.equal(due({deferredUntil:'2026-10-21'},[],config,wed),true);
});
test('three topics each get four total versions, and restarting cannot reset the budget',async()=>{
  const audit={},candidates=['a','b','c','d'].map(id=>({id}));let writes=0,saves=0;
  const args={audit,candidates,config,save:async()=>saves++,research:async()=>({}),write:async()=>{writes++;return story();},review:async()=>({facts:{approved:false,issues:['unsupported']},editorial:{approved:false,issues:['generic']}}),now:()=>now};
  await prepareIssue(args);assert.equal(writes,12);assert.equal(audit.attempts.length,12);assert.equal(audit.status,'exhausted');assert.ok(saves>12);
  await prepareIssue(args);assert.equal(writes,12);
});
test('an interrupted attempt is consumed and infrastructure errors defer without trying other topics',async()=>{
  const audit={attempts:[{key:'a:1',topicId:'a',version:1,status:'started'}]};let count=0;
  await prepareIssue({audit,candidates:[{id:'a'},{id:'b'}],config,save:async()=>{},research:async()=>({}),write:async()=>{count++;throw Object.assign(new Error('account unavailable'),{infrastructure:true});},review:async()=>{},now:()=>now});
  assert.equal(count,1);assert.equal(audit.attempts[1].version,2);assert.equal(audit.status,'deferred');
});
test('source checks reject missing original evidence even when model approves',async()=>{
  const s=story(),g=good();
  assert.equal((await verifyClaims(g.facts,s,async()=>({body:'No support here'}))).approved,false);
  assert.equal((await verifyClaims(g.facts,s,async()=>({body:'<p>original evidence</p>'}))).approved,true);
});
test('auto commit rejects source-code changes and publication needs the exact public revision',async()=>{
  assert.doesNotThrow(()=>assertChanges(['content/stories/a-song.json','dist/index.html']));
  assert.throws(()=>assertChanges(['scripts/build.mjs']),/only/);
  await assert.rejects(verifyPublished(story(),async()=>({ok:true,text:async()=>'<main>old</main>'})),/revision/);
});
test('caption approval cannot be reused after article or caption changes',async()=>{
  const config={origin:'https://indiek.com',platforms:['threads']},s=story();
  const p={id:'T-2026-10-21-1000-story',platform:'threads',scheduledAt:'2026-10-21T01:00:00Z',kind:'story',storyId:s.id,storyRevision:storyDigest(s),artistIds:[],url:'https://indiek.com/stories/a-song/?from=threads',imageUrl:'https://indiek.com/assets/social/stories-a-song.jpg',altText:'Original type card',sourceDescription:'A & B',copy:'A specific story\n\nhttps://indiek.com/stories/a-song/?from=threads',review:{approved:true,issues:[],reason:'Verified exact copy'}};
  p.review.copy=p.copy;p.payloadHash=hash(payloadParts(p));validatePost(p,config);
  p.copy+='!';assert.throws(()=>validatePost(p,config),/review/);
  await assert.rejects(verifyLive(p,async()=>({ok:true,headers:new Headers({'content-type':'text/html'}),text:async()=>'<main>other version</main>'})),/changed/);
});
test('story priority excludes an already queued or actually shared article',()=>{
  const items=[{id:'new',kind:'story',path:'/stories/new/',published:'2026-10-20'}];
  assert.equal(storyCandidate(items,[]).id,'new');
  assert.equal(storyCandidate(items,[{storyId:'new',status:'ready'}]),undefined);
  assert.equal(storyCandidate(items,[],[{copy:'https://indiek.com/stories/new/'}]),undefined);
});
for(const rejectBoth of [false,true])test(`caption review ${rejectBoth?'keeps the daily budget after a restart':'withholds both platforms until the shared revision passes'}`,async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'indiek-caption-test-'));
  const put=(file,value)=>{mkdirSync(path.dirname(path.join(root,file)),{recursive:true});writeFileSync(path.join(root,file),value);};
  try {
    const s={...story(),status:'published'};
    put('content/stories/a-song.json',JSON.stringify(s));put('promotion/voice.md','Read the article.');
    for(const f of ['SKILL.md','references/editing.md','references/benchmarks.json'])put(`skills/indiek-editorial/${f}`,'Source the account.');
    const store={posts:[],save(p){this.posts.push(p);}},seen=[];
    let version=0,calls=0;
    const ask=async(stage,prompt)=>{
      calls++;
      if(!prompt.includes('Final copy: ')){version++;return {copy:version===1?'The songwriter left home after an argument.':'She recalled leaving home after an argument.',approved:true,issues:[],reason:'Specific account'};}
      seen.push(store.posts.length);
      const copy=JSON.parse(prompt.split('Final copy: ')[1]),approved=version===2&&!rejectBoth||!copy.includes('?from=threads');
      return {copy,approved,issues:approved?[]:['Attribute her recollection.'],reason:'Checked against the attributed account'};
    };
    const options={root,store,ask,verify:async()=>{},now:new Date('2026-10-20T06:00:00Z'),recentPosts:[],config:{origin:'https://indiek.com',platforms:['threads','instagram'],previousPosts:[]},catalogue:{items:[{id:s.id,kind:'story',path:'/stories/a-song/',published:s.published,revision:storyDigest(s),artistIds:[],image:'/assets/social/stories-a-song.jpg',altText:'Original type card',description:'A reported account'}]}};
    const result=await prepareStory(options);
    assert.equal(result.status,rejectBoth?'story-held':'story-prepared');
    assert.equal(store.posts.length,rejectBoth?0:2);assert.deepEqual(seen,[0,0,0,0]);
    if(!rejectBoth)assert.ok(store.posts.every(p=>p.copy.startsWith('She recalled')));
    const audit=JSON.parse(readFileSync(path.join(root,'promotion/state/stories/2026-10-21.json'),'utf8'));
    assert.equal(audit.attempts.length,2);assert.equal(audit.attempts[0].status,'rejected');
    const before=calls;await prepareStory(options);assert.equal(calls,before);
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('a lost deployment response resumes the same pushed commit without publishing a second article',async()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'indiek-publisher-test-')),root=path.join(dir,'repo'),remote=path.join(dir,'remote.git');
  mkdirSync(root);
  const exec=(cwd,name,args,input)=>execFileSync(name,args,{cwd,encoding:'utf8',input,stdio:['pipe','pipe','pipe']}).trim();
  try{
    exec(dir,'git',['init','--bare',remote]);exec(root,'git',['init','-b','main']);
    exec(root,'git',['config','user.name','Test']);exec(root,'git',['config','user.email','test@example.com']);
    const put=(file,value)=>{mkdirSync(path.dirname(path.join(root,file)),{recursive:true});writeFileSync(path.join(root,file),value);};
    put('.gitignore','editorial/state/\n');
    put('content/authors.json',JSON.stringify(authors));put('content/catalogue.json',JSON.stringify({records:[],editorPick:{id:'pick'}}));
    for(const f of ['SKILL.md','references/editing.md','references/benchmarks.json'])put(`skills/indiek-editorial/${f}`,'test');
    exec(root,'git',['add','.']);exec(root,'git',['commit','-m','Baseline']);exec(root,'git',['remote','add','origin',remote]);exec(root,'git',['push','-u','origin','main']);
    const s=story(),g=good();s.review=approval(g.facts,g.editorial,s,skillRevision(root),now);
    const audit={day:'2026-10-20',status:'approved',story:s};let sends=0,verified=0;
    const execute=(cwd,name,args,input)=>{
      if(name==='npm'){
        if(args.includes('build')){mkdirSync(path.join(cwd,'dist'),{recursive:true});writeFileSync(path.join(cwd,'dist/index.html'),'generated');}return '';
      }
      if(name==='ssh'){sends++;if(sends===1)throw new Error('lost response');return 'already deployed';}
      return exec(cwd,name,args,input);
    };
    const options={root,audit,config:{...config,remote:'origin',deployHost:'test'},save:async()=>{},now,execute,verify:async()=>verified++,checkSources:async()=>g.facts};
    await assert.rejects(publishIssue(options),/lost response/);
    const first=audit.commit;assert.equal(audit.phase,'pushed');assert.ok(first);
    await publishIssue(options);assert.equal(audit.commit,first);assert.equal(audit.status,'published');assert.equal(verified,1);
    assert.equal(exec(dir,'git',['--git-dir',remote,'rev-list','--count','main']),'2');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
