import {execFileSync} from 'node:child_process';
import {mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {atomicWrite,readJSON} from '../promotion/core.mjs';
import {loadStories,validateStory,skillRevision,storyDigest} from './content.mjs';
import {due} from './workflow.mjs';
import {koreanDay} from '../promotion/news.mjs';
import {verifyClaims} from './ai.mjs';

export const allowedChange = file => /^content\/stories\/[a-z0-9-]+\.json$/.test(file)||file.startsWith('dist/');
export function assertChanges(files) {
  if(!files.length||files.some(f=>!allowedChange(f)))throw new Error('Automated publication may change story JSON and generated dist only');
}
const command=(cwd,name,args,input)=>execFileSync(name,args,{cwd,input,encoding:'utf8',timeout:300000,maxBuffer:8*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
export async function verifyPublished(story,fetcher=fetch) {
  const url=`https://indiek.com/stories/${story.slug}/`;
  const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok||!(await response.text()).includes(`data-story-revision="${storyDigest(story)}"`))throw new Error('Deployed article revision does not match approved content');
  const manifest=await fetcher('https://indiek.com/promotion-catalogue.json',{redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!manifest.ok||!(await manifest.json()).items.some(i=>i.kind==='story'&&i.id===story.id&&i.revision===storyDigest(story)))throw new Error('Published article manifest is stale');
}
export async function publishIssue({root,audit,config,save,now=new Date(),execute=command,verify=verifyPublished,checkSources=s=>verifyClaims(s.review.facts,s)}) {
  if(audit.status==='published')return audit;
  if(audit.status!=='approved'&&!audit.commit)throw new Error('No approved issue to publish');
  const git=(cwd,...args)=>execute(cwd,'git',args);
  // No shell interpolation, force push, checkout changes or credentials reach the writer.
  git(root,'fetch',config.remote,'main');
  if(!audit.commit) {
    if(audit.story.published!==koreanDay(now))throw new Error('Draft is from a previous day; prepare and review a fresh issue');
    const facts=await checkSources(audit.story);
    if(!facts.approved||facts.issues.length)throw new Error('Sources no longer support the approved version; prepare a new review');
    const base=git(root,'rev-parse',`${config.remote}/main`);
    const parent=path.join(root,'editorial/state/worktrees');mkdirSync(parent,{recursive:true});
    const work=path.join(parent,`${audit.day}-${process.pid}`);
    git(root,'worktree','add','--detach',work,base);
    try {
      const authors=readJSON(path.join(work,'content/authors.json'));
      const catalogue=readJSON(path.join(work,'content/catalogue.json'));
      validateStory(audit.story,{authors,tracks:[...catalogue.records,catalogue.editorPick],approved:true});
      if(audit.story.review.skillRevision!==skillRevision(work))throw new Error('Editorial skill changed since review');
      const existing=loadStories(work);
      if(!due({deferredUntil:audit.day},existing,config,now))throw new Error('Publication rate limit reached');
      const file=`content/stories/${audit.story.slug}.json`;
      if(existsSync(path.join(work,file)))throw new Error('Story already exists; automatic publisher cannot replace an article');
      const story={...audit.story,status:'published'};
      atomicWrite(path.join(work,file),JSON.stringify(story,null,2)+'\n');
      execute(work,'npm',['run','build']);execute(work,'npm',['run','check']);
      const changed=[git(work,'diff','--name-only'),git(work,'ls-files','--others','--exclude-standard')].join('\n').split('\n').filter(Boolean);
      assertChanges(changed);
      git(work,'add','--',file,'dist');
      assertChanges(git(work,'diff','--cached','--name-only').split('\n'));
      git(work,'-c','user.name=indiek publisher','-c','user.email=gw@lumejs.com','commit','-m',`Publish story: ${story.title}`);
      audit.commit=git(work,'rev-parse','HEAD');git(root,'update-ref',`refs/indiek/issues/${audit.day}`,audit.commit);
      audit.base=base;audit.story=story;audit.phase='committed';await save(audit);
    }finally{git(root,'worktree','remove','--force',work);}
  }
  git(root,'fetch',config.remote,'main');
  const current=git(root,'rev-parse',`${config.remote}/main`);
  if(current!==audit.commit) {
    if(current!==audit.base)throw new Error('Origin advanced during publication; hold this issue for reconciliation');
    // A lost push response is reconciled against origin/main on the next invocation.
    git(root,'push',config.remote,`${audit.commit}:refs/heads/main`);
  }
  audit.phase='pushed';await save(audit);
  // The server key is restricted to a fixed receiver. JSON on stdin is the only input.
  execute(root,'ssh',['-T','-o','ConnectTimeout=15',config.deployHost],JSON.stringify({sha:audit.commit})+'\n');
  await verify(audit.story);
  audit.status='published';audit.phase='verified';audit.publishedAt=new Date().toISOString();await save(audit);
  return audit;
}
