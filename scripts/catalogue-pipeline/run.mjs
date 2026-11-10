// Catalogue expansion runner (W3). Modelled on scripts/editorial/run.mjs: codex research and drafting,
// a real embedded-playback check, independent review bound to a content hash, then a local apply step.
// It never commits, pushes, deploys or enables timers; publication stays a separate, approved step.
import {existsSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadCatalogue} from '../catalogue.mjs';
import {atomicWrite,readJSON,withLock} from '../promotion/core.mjs';
import {koreanDay} from '../promotion/news.mjs';
import {askJSON} from '../editorial/ai.mjs';
import {LENSES,lensPrompt,existingNames,mergeCandidates,scoreCandidates,lookupDeezer,lookupApple,renderCandidates} from './candidates.mjs';
import {catalogueInstructions,loadSearchRows,parseSearchConsoleCSV} from './context.mjs';
import {prepareTracks,reviewExisting,trackStatus} from './tracks.mjs';
import {applyApproved} from './apply.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const dir=path.join(root,'editorial/catalogue'),state=path.join(dir,'state');
const config=readJSON(path.join(dir,'config.json'));
const files={candidates:path.join(dir,'candidates.json'),markdown:path.join(dir,'candidates.md'),search:path.join(dir,'signals/search-console.json'),ledger:path.join(dir,'ledger.json')};
const [command='status',...args]=process.argv.slice(2);
const day=koreanDay(new Date());
const write=(file,value)=>atomicWrite(file,JSON.stringify(value,null,2)+'\n');
const pool=async(items,limit,task)=>{const queue=[...items],out=[];await Promise.all(Array.from({length:Math.min(limit,queue.length)},async()=>{while(queue.length){const item=queue.shift();out.push(await task(item));}}));return out;};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const lensFiles=()=>{const folder=path.join(state,'lenses');return existsSync(folder)?readdirSync(folder).filter(f=>f.endsWith('.json')).map(f=>path.join(folder,f)):[];};
// A later pass (--pass 2) asks each lens again for artists not found so far, to reach the target.
async function researchLenses(selected) {
  const at=selected.indexOf('--pass'),pass=at>=0?Number(selected.splice(at,2)[1]):1;
  if(!Number.isInteger(pass)||pass<1)throw new Error('--pass needs a positive number');
  const catalogue=loadCatalogue(root),skill=catalogueInstructions(root);
  const found=lensFiles().flatMap(f=>readJSON(f,{candidates:[]}).candidates.map(c=>c.name));
  const existing=[...existingNames(catalogue).map(e=>e.id),...new Set(found)];
  const lenses=selected.length?selected:Object.keys(LENSES);
  for(const lens of lenses)if(!LENSES[lens])throw new Error(`Unknown lens ${lens}. Lenses: ${Object.keys(LENSES).join(', ')}`);
  await pool(lenses,config.lensConcurrency,async lens=>{
    const file=path.join(state,'lenses',`${lens}${pass>1?`-${pass}`:''}.json`);
    if(readJSON(file,null)?.day===day){console.log(`${lens}: pass ${pass} already researched today`);return;}
    const started=Date.now();
    try{
      const result=await askJSON(root,'candidates',lensPrompt({skill,lens,question:LENSES[lens],existing,perLens:config.perLens})+(pass>1?' Earlier passes already found the excluded names; return different artists only.':''),{timeout:config.researchTimeoutSeconds*1000,schema:path.join(root,'scripts/catalogue-pipeline/candidates.schema.json')});
      write(file,{day,lens,checkedAt:new Date().toISOString(),...result,lens});
      console.log(`${lens}: ${result.candidates.length} candidates in ${Math.round((Date.now()-started)/1000)}s`);
    }catch(error){console.error(`${lens}: ${error.message}`);}
  });
}

async function enrich({force=false}={}) {
  const catalogue=loadCatalogue(root);
  const results=lensFiles().sort().map(f=>readJSON(f,null)).filter(Boolean);
  const previous=readJSON(files.candidates,{candidates:[]}).candidates;
  const merged=mergeCandidates(results,catalogue,previous);
  let n=0;
  for(const c of merged){
    if(!force&&c.checked&&Date.now()-Date.parse(c.checked)<30*86400000)continue;
    try{
      c.deezer=await lookupDeezer(c);
      // The iTunes Search API allows roughly 20 requests a minute.
      c.apple=await lookupApple(c);await sleep(3200);
      c.checked=day;
    }catch(error){console.error(`${c.id}: ${error.message}`);await sleep(10000);}
    if(++n%20===0){write(files.candidates,{generated:day,candidates:merged});console.log(`enriched ${n}`);}
  }
  write(files.candidates,{generated:day,candidates:merged});
  return merged;
}

function score() {
  const data=readJSON(files.candidates,null);
  if(!data)throw new Error('No candidates yet: run candidates research, then candidates enrich');
  const search=loadSearchRows(files.search);
  const ranked=scoreCandidates(data.candidates,{weights:config.weights,searchRows:search.rows});
  ranked.forEach((c,i)=>{c.rank=i+1;});
  write(files.candidates,{generated:data.generated,scored:day,weights:config.weights,searchConsole:search.note,candidates:ranked});
  atomicWrite(files.markdown,renderCandidates(ranked,{checked:day,weights:config.weights,signalsNote:search.note}));
  console.log(`${ranked.length} candidates ranked; ${ranked.filter(c=>!c.blockers.length).length} without blockers. See editorial/catalogue/candidates.md`);
}

// Batch approval is the user's decision. It records who approved what and when; adding to the
// catalogue still requires research, playback, drafting and review to pass.
function approve(batch,ids,{by='user'}={}) {
  if(!/^[a-z0-9-]+$/.test(batch||'')||!ids.length)throw new Error('Usage: approve <batch-id> <candidate-id>…');
  const data=readJSON(files.candidates,null);
  for(const id of ids){
    const c=data.candidates.find(c=>c.id===id);
    if(!c)throw new Error(`Unknown candidate ${id}`);
    if(c.status!=='proposed')throw new Error(`${id} is already ${c.status}`);
    Object.assign(c,{status:'approved',batch,approved:{date:day,by}});
  }
  write(files.candidates,data);
  atomicWrite(files.markdown,renderCandidates(data.candidates,{checked:data.scored,weights:data.weights,signalsNote:data.searchConsole}));
  console.log(`Approved ${ids.length} candidates for ${batch}.`);
}

async function run() {
  if(command==='status'){console.log(JSON.stringify(trackStatus({root,state,files}),null,2));return;}
  await withLock(state,async()=>{
    if(command==='candidates'){
      const [sub,...rest]=args;
      if(sub==='research')return researchLenses(rest);
      if(sub==='enrich')return void await enrich({force:rest.includes('--force')});
      if(sub==='score')return score();
      if(sub==='import-search'){
        // A Performance → Queries CSV exported from Search Console, or JSON rows from the API.
        const rows=parseSearchConsoleCSV(rest[0]);
        write(files.search,{source:rest[1]||'Search Console export',checked:day,period:rest[2]||'unknown',rows});
        console.log(`Imported ${rows.length} queries.`);return;
      }
      throw new Error('Usage: candidates research [lens…] | enrich [--force] | score | import-search <file.csv> [source] [period]');
    }
    if(command==='approve')return approve(args[0],args.slice(1));
    if(command==='prepare')return void await prepareTracks({root,state,config,files,batch:args[0],only:args.slice(1)});
    if(command==='apply')return void await applyApproved({root,state,config,files,batch:args[0]});
    if(command==='review'){const result=await reviewExisting({root,config,files,trackId:args[0]});console.log(JSON.stringify(result,null,2));if(!result.approved)process.exitCode=1;return;}
    if(command==='sample'){
      // Records the human review of a sampled song; it never changes the reviewed content.
      const [id,status,...note]=args,ledger=readJSON(files.ledger,null);
      if(!ledger?.tracks?.[id]?.humanSample||!['approved','changes-requested'].includes(status))throw new Error('Usage: sample <sampled-track-id> approved|changes-requested [note]');
      ledger.tracks[id].humanReview={status,date:day,by:'user',...(note.length?{note:note.join(' ')}:{})};
      write(files.ledger,ledger);console.log(`${id}: ${status}`);return;
    }
    throw new Error('Commands: status, candidates …, approve <batch> <id…>, prepare <batch> [artist-id…], apply <batch>, review <track-id>, sample <track-id> approved|changes-requested [note]');
  });
}
run().catch(error=>{console.error(error.message);process.exitCode=1;});
