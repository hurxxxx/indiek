import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {atomicWrite,readJSON,withLock} from '../promotion/core.mjs';
import {koreanDay} from '../promotion/news.mjs';
import {loadStories,validateStory,skillRevision} from './content.mjs';
import {due,prepareIssue,tomorrow} from './workflow.mjs';
import {askJSON,instructions,reviewStory} from './ai.mjs';
import {publishIssue} from './publisher.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url)),state=path.join(root,'editorial/state');
const config=readJSON(path.join(root,'editorial/config.json')),command=process.argv[2]||'status';
const now=new Date(),day=koreanDay(now),file=path.join(state,`${day}.json`);
const statusFile=path.join(state,'status.json');
const save=a=>{
  atomicWrite(file,JSON.stringify(a,null,2)+'\n');
  // Persist the pointer with each attempt/commit. A killed process cannot hide an
  // unconfirmed push from the next day's run.
  atomicWrite(statusFile,JSON.stringify({day:a.day,status:a.status,commit:a.commit,phase:a.phase,reason:a.reason,...(a.status!=='published'?{deferredUntil:tomorrow(new Date())}:{})},null,2)+'\n');
};
async function run() {
  if(command==='status'){console.log(JSON.stringify({config,latest:readJSON(statusFile,null),today:readJSON(file,null)},null,2));return;}
  await withLock(state,async()=>{
    if(command==='references') {
      const result=await askJSON(root,'references',`${instructions(root)}\nCheck reference availability, bylines and actual reader responses this month. Distinguish changed/inaccessible sources and suggest better original human bylined music writing with URLs and observed reception. Do not modify the skill or invent engagement. Return findings and suggestions.`);
      atomicWrite(path.join(state,`references-${day.slice(0,7)}.json`),JSON.stringify({checkedAt:now.toISOString(),skillRevision:skillRevision(root),...result},null,2)+'\n');return;
    }
    if(!['prepare','publish','run'].includes(command))throw new Error('Commands: status, prepare, publish, run, references');
    if(process.env.INDIEK_EDITORIAL_SERVER==='1'){
      execFileSync('git',['fetch',config.remote,'main'],{cwd:root,stdio:'ignore'});
      execFileSync('git',['merge','--ff-only',`${config.remote}/main`],{cwd:root,stdio:'ignore'});
    }
    const prior=readJSON(statusFile,{}),stories=loadStories(root);
    let audit=readJSON(file,{day,status:'pending',skillRevision:skillRevision(root)});
    // A committed but unconfirmed publication always needs reconciliation before another issue.
    if(prior.day&&prior.day!==day) {
      const old=readJSON(path.join(state,`${prior.day}.json`),{});
      if(old.commit&&old.status!=='published')throw new Error(`Unconfirmed commit from ${prior.day}; inspect before preparing another issue`);
    }
    if(command!=='publish'&&!audit.commit&&audit.status!=='approved'&&audit.status!=='published') {
      if(!due(prior,stories,config,now)){console.log('No issue due; publication limits or schedule apply.');return;}
      const catalogue=readJSON(path.join(root,'content/catalogue.json')),tracks=[...catalogue.records,catalogue.editorPick],authors=readJSON(path.join(root,'content/authors.json'));
      const topics=readJSON(path.join(root,'editorial/topics.json')).filter(t=>!stories.some(s=>s.id===t.id)&&!t.duplicateOf&&t.status!=='retired');
      const skill=instructions(root);
      audit.startedAt ||= new Date().toISOString();await save(audit);
      const ask=(stage,prompt)=>{
        const remaining=config.deadlineSeconds*1000-(Date.now()-Date.parse(audit.startedAt));
        if(remaining<=0)throw Object.assign(new Error('Preparation time budget reached'),{infrastructure:true});
        return askJSON(root,stage,prompt,{timeout:Math.min(config.callTimeoutSeconds*1000,remaining)});
      };
      if(!audit.candidates){
        const selected=await ask('select',`${skill}\nToday ${day} KST. Select up to ${config.maxTopics} distinct topics by reader interest and current context, with evergreen alternatives. Verify any claimed timeliness with live search. Never manufacture urgency. Topics: ${JSON.stringify(topics)}. Previous published stories: ${JSON.stringify(stories.map(s=>({id:s.id,title:s.title,published:s.published})))}. Return existing topic IDs, reasons, and separate future ideas. Do not repeat a published angle.`);
        audit.selection=selected;
        audit.candidates=selected.candidates.map(c=>({...topics.find(t=>t.id===c.id),reason:c.reason})).filter(c=>c.id).filter((c,i,a)=>a.findIndex(x=>x.id===c.id)===i).slice(0,config.maxTopics);await save(audit);
      }
      audit=await prepareIssue({audit,candidates:audit.candidates,config,save,
        research:async(topic,previous)=>{
          const d=await ask('research',`${skill}\nResearch this topic for ${day}: ${JSON.stringify(topic)}. Previous objections: ${JSON.stringify(previous.map(a=>a.reason))}. Open original sources; provide source dates, checked dates, exact short claim evidence, outline, uncertainties, reference choices. Existing recordings, do not invent additional playable tracks: ${JSON.stringify(tracks.map(({id,artist,track,url,performance})=>({id,artist,track,url,performance})))}. Do not claim listening without supplied listening notes. A useful reported article can be shorter than a feature. Limit source-derived prose to 200 words per source, 25 quoted words, and respect stricter source limits.`);
          return {...d,history:[...stories].sort((a,b)=>b.published.localeCompare(a.published)).slice(0,5),recordings:tracks,renderedNotice:'Features under indiek use AI-assisted research, drafting and automated checks. Original reporting is credited with links. /about/#editorial'};
        },
        write:async(topic,dossier,previous)=>{
          const draft=await ask('draft',`${skill}\nWrite the complete revised English article, not edit instructions. Topic: ${JSON.stringify(topic)}. Dossier: ${JSON.stringify(dossier)}. Previous drafts and findings: ${JSON.stringify(previous)}. Facts only from checked sources; do not fill gaps. Use the block schema (unused text/trackId empty); listen blocks only verified catalogue track IDs. Let the material set the length; a specific concise piece is preferable to padded context. Title and description are reviewed too.`);
          const s={id:topic.id,slug:topic.id,status:'draft',category:topic.category,title:draft.title,description:draft.description,authorId:'indiek',published:day,updated:day,artistIds:tracks.some(t=>t.id===topic.artistId)?[topic.artistId]:[],keywords:draft.keywords,sources:dossier.sources,blocks:draft.blocks.map(b=>b.type==='listen'?{type:b.type,trackId:b.trackId,sources:b.sources}:{type:b.type,text:b.text,sources:b.sources})};
          validateStory(s,{authors,tracks});return s;
        },
        review:(s,d)=>reviewStory(root,s,d,{ask})
      });
    }
    if((command==='run'||command==='publish')&&(audit.status==='approved'||audit.commit)&&audit.status!=='published')audit=await publishIssue({root,audit,config,save,now});
    const status={day,status:audit.status,commit:audit.commit,checkedAt:new Date().toISOString(),reason:audit.reason};
    if(['exhausted','deferred'].includes(audit.status))status.deferredUntil=tomorrow(now);
    atomicWrite(statusFile,JSON.stringify(status,null,2)+'\n');
    console.log(JSON.stringify(status));
    if(audit.status==='published'&&process.env.INDIEK_EDITORIAL_SERVER==='1'){
      execFileSync('git',['fetch',config.remote,'main'],{cwd:root,stdio:'ignore'});
      execFileSync('git',['merge','--ff-only',`${config.remote}/main`],{cwd:root,stdio:'ignore'});
    }
  });
}
run().catch(error=>{
  const audit=readJSON(file,null);
  if(audit&&!audit.commit&&audit.status!=='published'){
    audit.status='deferred';audit.reason=error.message;save(audit);
    atomicWrite(statusFile,JSON.stringify({day,status:'deferred',deferredUntil:tomorrow(now),reason:error.message},null,2)+'\n');
  }
  console.error(error.message);process.exitCode=1;
});
