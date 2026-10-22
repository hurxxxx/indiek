import {readFileSync,existsSync,mkdirSync,statSync,chmodSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {homedir} from 'node:os';
import {Store,atomicWrite,readJSON,withLock,validatePost,verifyLive,publishScheduledPost} from './core.mjs';
import {metaClient,recentOwnPosts,refreshToken} from './meta.mjs';
import {prepareDaily,reviewBeforePublish} from './news-runner.mjs';
import {prepareStory} from './stories.mjs';
import {shareStoryNow} from './on-demand.mjs';
import {sharePageNow} from './page-now.mjs';

const root=fileURLToPath(new URL('../../',import.meta.url));
const config=readJSON(path.join(root,'promotion/config.json'));
const state=path.join(root,'promotion/state');
const credentialFile=path.join(homedir(),'.config/indiek-promotion/credentials.json');
const command=process.argv[2]||'status';
const argument=process.argv[3];
const local=process.argv.includes('--local');
const now=new Date();

function credentials() {
  if(!existsSync(credentialFile))return {};
  if(statSync(credentialFile).mode&0o077)throw new Error('Credentials file must have mode 600.');
  try{return readJSON(credentialFile,{});}catch{throw new Error('Invalid credentials file. Values omitted.');}
}
function stateNote(message) {
  atomicWrite(path.join(state,'status.json'),JSON.stringify({checkedAt:new Date().toISOString(),message},null,2)+'\n');
  console.log(message);
}
async function publicCatalogue() {
  if(local)return readJSON(path.join(root,'dist/promotion-catalogue.json'));
  const response=await fetch(`${config.origin}/promotion-catalogue.json`,{redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`Public promotion catalogue unavailable (HTTP ${response.status}). Deploy the reviewed site before automation can select its content.`);
  const data=await response.json();
  if(data.origin!==config.origin||data.version!==1||!Array.isArray(data.items))throw new Error('Invalid public promotion catalogue.');
  return data;
}
async function prepare(store) {
  const catalogue=await publicCatalogue();
  const recentPosts=await recentOwnPosts(config,credentials());
  const result=await prepareStory({root,config,store,catalogue,recentPosts,now})||await prepareDaily({root,config,store,catalogue,recentPosts,now});
  stateNote(`Daily news ${result.day}: ${result.status}. ${result.reason||'Read the recorded selection.'} No posts published.`);
}
async function publish(store,platform) {
  if(!config.platforms.includes(platform))throw new Error('Specify threads or instagram.');
  const secret=credentials(),credential=secret[platform];
  if(!credential?.token){stateNote(`${platform}: account authorization missing; no API calls or posts.`);return;}
  if(store.posts.some(p=>p.platform===platform&&p.pausePlatform)){stateNote(`${platform}: paused after an authorization or platform restriction; inspect the recorded issue before resuming.`);process.exitCode=1;return;}
  if(await refreshToken(platform,credential))atomicWrite(credentialFile,JSON.stringify(secret,null,2)+'\n');
  const api=metaClient(platform,credential);
  let recentPosts;
  const recent=async()=>recentPosts??=await recentOwnPosts({...config,platforms:[platform]},secret);
  let failed=false;
  for(const post of store.posts.filter(p=>p.mode!=='on-demand'&&p.platform===platform&&!['published','expired','superseded'].includes(p.status))) {
    await publishScheduledPost(post,{config,store,api,now,recent,verify:post.kind==='news'?async p=>reviewBeforePublish(p,{root,config,posts:store.posts,recentPosts:await recent(),now}):verifyLive});
    if(['held','creating','publishing','submitted'].includes(post.status)||post.pausePlatform)failed=true;
    if(post.pausePlatform)break;
  }
  stateNote(`${platform}: ${failed?'publishing held; inspect the recorded error before resuming':'scheduled queue checked'}. Read docs/promotion.md for actual results.`);
  if(failed)process.exitCode=1;
}
async function storyNow(store) {
  if(local)throw new Error('story-now requires the live public catalogue.');
  const secret=credentials();
  for(const platform of config.platforms) {
    if(!secret[platform]?.token)throw new Error(`${platform}: authorization required for this request.`);
    if(await refreshToken(platform,secret[platform]))atomicWrite(credentialFile,JSON.stringify(secret,null,2)+'\n');
  }
  const result=await shareStoryNow({root,config,store,catalogue:await publicCatalogue(),storyId:argument,recent:()=>recentOwnPosts(config,secret),apiFor:platform=>metaClient(platform,secret[platform])});
  stateNote(`On-demand story ${argument}: ${result.status}. Read docs/promotion.md for actual results.`);
  console.log(JSON.stringify(result,null,2));
  if(!['published','story-already-queued-or-shared'].includes(result.status))process.exitCode=1;
}
async function pageNow(store) {
  if(local)throw new Error('page-now requires the live public catalogue.');
  const secret=credentials(),checkOnly=process.argv.includes('--check');
  for(const platform of config.platforms) {
    if(!secret[platform]?.token)throw new Error(`${platform}: authorization required for this request.`);
    if(!checkOnly&&await refreshToken(platform,secret[platform]))atomicWrite(credentialFile,JSON.stringify(secret,null,2)+'\n');
  }
  const result=await sharePageNow({root,config,store,catalogue:await publicCatalogue(),kind:argument,pageId:process.argv[4],checkOnly,recent:()=>recentOwnPosts(config,secret),apiFor:platform=>metaClient(platform,secret[platform])});
  console.log(JSON.stringify(result,null,2));
  if(!['checked','published','already-queued-or-shared'].includes(result.status))process.exitCode=1;
}
async function matomoReport(secret) {
  if(!secret?.matomo?.token)return {status:'Not connected. No visitor count inferred.'};
  const request=async(method,period,date,extra={})=>{
    const response=await fetch('https://matomo.lumejs.com/index.php',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({module:'API',method,idSite:'4',period,date,format:'JSON',token_auth:secret.matomo.token,...extra}),signal:AbortSignal.timeout(20000)});
    const result=await response.json();if(!response.ok||result.result==='error')throw new Error('Matomo report access unavailable');return result;
  };
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  // A range query asks Matomo to deduplicate the whole interval; daily uniques are never added.
  const start=new Date(Date.parse(`${day}T00:00:00Z`)-29*86400000).toISOString().slice(0,10);
  return {status:'Consenting browsers only; not all people or social impressions.',range:`${start},${day}`,visits:await request('VisitsSummary.get','range',`${start},${day}`),returning:await request('VisitFrequency.get','range',`${start},${day}`),events:await request('Events.getCategory','range',`${start},${day}`)};
}
async function report(store) {
  let analytics;
  try{analytics=await matomoReport(credentials());}catch{analytics={status:'Matomo unavailable; no figures inferred.'};}
  const report={checkedAt:now.toISOString(),queue:store.posts.map(({id,platform,status,permalink,issue})=>({id,platform,status,permalink,issue})),analytics,searchConsole:'Review the verified indiek.com property; automatic Google reporting is not connected.',nextReview:['Compare search clicks with consenting visits, not social impressions.','Review one guide and one artist page; spend 1–2 hours checking selection and facts.','After four weeks, keep topics that bring actual listening and returns.']};
  atomicWrite(path.join(state,'reports',`${now.toISOString().slice(0,10)}.json`),JSON.stringify(report,null,2)+'\n');
  const summary=`# indiek weekly review\n\nChecked: ${report.checkedAt}\n\n${store.posts.filter(p=>p.status==='published').length} API-verified posts. ${store.posts.filter(p=>p.status==='ready').length} prepared posts.\n\nAnalytics: ${analytics.status}\n\nSearch Console: ${report.searchConsole}\n\n${report.nextReview.map(s=>'- '+s).join('\n')}\n\nDetailed observed values: ${now.toISOString().slice(0,10)}.json\n`;
  atomicWrite(path.join(state,'reports/latest.md'),summary);stateNote('Weekly report saved. Missing measurements are identified, not estimated.');
}
async function run() {
  const store=new Store(root);
  if(command==='status') {
    const secret=credentials();console.log(JSON.stringify({account:config.account,credentials:Object.fromEntries(config.platforms.map(p=>[p,{connected:Boolean(secret[p]?.token),expiresAt:secret[p]?.expiresAt||null}])),queue:store.posts.map(({id,status,scheduledAt,issue})=>({id,status,scheduledAt,issue})),lastRun:readJSON(path.join(state,'status.json'),null)},null,2));return;
  }
  if(command==='credentials') {
    if(argument!=='--stdin')throw new Error('Use credentials --stdin with JSON from a secure local file; never put tokens in command arguments.');
    let incoming;try{incoming=JSON.parse(readFileSync(0,'utf8'));}catch{throw new Error('Invalid credentials JSON. Values omitted.');}
    for(const platform of config.platforms)if(incoming[platform]){metaClient(platform,incoming[platform]);if(!incoming[platform].expiresAt||!incoming[platform].issuedAt)throw new Error('Token issue and expiry dates required.');}
    atomicWrite(credentialFile,JSON.stringify({...credentials(),...incoming},null,2)+'\n');chmodSync(credentialFile,0o600);console.log('Credentials saved outside the repository. Values not logged.');return;
  }
  if(command==='check') {
    const secret=credentials();
    for(const platform of config.platforms)if(!secret[platform]?.token)throw new Error(`${platform}: account authorization missing.`);
    const recent=await recentOwnPosts(config,secret),catalogue=await publicCatalogue();
    console.log(JSON.stringify({account:config.account,platforms:config.platforms.map(platform=>({platform,accessible:true,recentPosts:recent.filter(p=>p.platform===platform).length})),publicItems:catalogue.items.length,sent:false},null,2));return;
  }
  await withLock(state,async()=>{
    if(command==='prepare')await prepare(store);
    else if(command==='story-now')await storyNow(store);
    else if(command==='page-now')await pageNow(store);
    else if(command==='publish')await publish(store,argument);
    else if(command==='report')await report(store);
    else if(command==='weekly')await report(store);
    else if(command==='sync-log')store.log();
    else if(command==='dry-run'){
      for(const post of store.posts.filter(p=>!['published','expired','superseded'].includes(p.status))){validatePost(post,config);try{await verifyLive(post);console.log(`${post.id}: source and any required image accessible; independent review runs again at send time; not sent`);}catch(error){console.log(`${post.id}: blocked — ${error.message}`);}}
      if(!store.posts.length){await publicCatalogue();console.log('Public catalogue readable; no prepared jobs.');}
    }else throw new Error('Commands: status, check, prepare [--local], story-now STORY_ID (publishes), page-now artist|guide ID [--check] (publishes without --check), dry-run, publish threads|instagram, report, weekly, sync-log, credentials --stdin');
  });
}
run().catch(error=>{stateNote(error.safeMessage||error.message);process.exitCode=1;});
