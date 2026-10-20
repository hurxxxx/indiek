import path from 'node:path';
import {atomicWrite,readJSON,publishPost,verifyLive} from './core.mjs';
import {prepareStory} from './stories.mjs';
import {koreanDay} from './news.mjs';

// Only the explicit story-now CLI uses this route. Timers retain their normal frequency limits.
export async function shareStoryNow({root,config,store,catalogue,storyId,recent,apiFor,clock=()=>new Date(),ask,verify=verifyLive,send=publishPost}) {
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(storyId||''))throw new Error('Specify a published story ID.');
  const item=catalogue.items.find(i=>i.kind==='story'&&i.id===storyId);
  if(!item)throw new Error('Story is absent from the public catalogue; publish it first.');
  if(store.posts.some(p=>config.platforms.includes(p.platform)&&p.pausePlatform))throw new Error('A platform is paused; resolve its recorded restriction first.');
  const file=path.join(root,`promotion/state/stories/on-demand/${storyId}.json`);
  let audit=readJSON(file,null);
  const now=clock(),recentPosts=await recent();
  if(!audit) {
    if(store.posts.some(p=>p.storyId===storyId&&!['expired','superseded'].includes(p.status))||recentPosts.some(p=>p.copy?.includes(item.path)))return {status:'story-already-queued-or-shared',jobIds:[]};
    // Reserve IDs once. The scheduled time is real time, even if a minute label is occupied.
    let stamp=now,slots;
    do {
      const hhmm=new Date(stamp.getTime()+9*3600000).toISOString().slice(11,16).replace(':','');
      slots=config.platforms.map(platform=>({platform,scheduledAt:now.toISOString(),id:`${platform==='threads'?'T':'I'}-${koreanDay(stamp)}-${hhmm}-story`}));
      stamp=new Date(stamp.getTime()+60000);
    }while(slots.some(s=>store.posts.some(p=>p.id===s.id)));
    audit={storyId,revision:item.revision,request:{storyId,requestedAt:now.toISOString(),reason:'Explicit operator story-now request; one-time exception to daily frequency',slots},attempts:[]};
    atomicWrite(file,JSON.stringify(audit,null,2)+'\n');
  }
  if(audit.revision!==item.revision)throw new Error('Article revision changed during this request; inspect its existing audit before proceeding.');
  const ids=audit.request.slots.map(s=>s.id);
  if(store.posts.some(p=>p.storyId===storyId&&!ids.includes(p.id)&&!['expired','superseded'].includes(p.status)))throw new Error('Another job already owns this story; reconcile it first.');
  const result=await prepareStory({root,config,store,catalogue,recentPosts,now,ask,verify,request:audit.request});
  if(result.status!=='story-prepared')return result;
  for(const id of result.jobIds) {
    const post=store.posts.find(p=>p.id===id);
    if(!post||post.mode!=='on-demand'||post.storyId!==storyId)throw new Error('On-demand queue identity mismatch.');
    if(['published','expired','superseded','held','creating'].includes(post.status))continue;
    // An uncertain response must use the existing reconciliation path, never a new send.
    if(['ready','created'].includes(post.status)) {
      const current=await recent();
      if(current.some(p=>p.platform===post.platform&&p.copy?.includes(item.path))) {
        post.status='held';post.issue='This article already appears in the actual account history; reconcile without resending.';
        store.save(post,'전송 직전 기사 중복 확인');continue;
      }
    }
    try {
      const api=await apiFor(post.platform);
      await send(post,{config,store,api,verify,now:clock()});
    }catch(error){
      post.issue=error.safeMessage||error.message;
      if(error.pausePlatform)post.pausePlatform=true;
      store.save(post,'비정기 발행 전 확인 실패');throw error;
    }
  }
  audit=readJSON(file);
  audit.results=result.jobIds.map(id=>{const p=store.posts.find(p=>p.id===id);return {id,status:p.status,permalink:p.permalink};});
  audit.checkedAt=clock().toISOString();
  audit.status=audit.results.every(p=>p.status==='published')?'published':'held';
  atomicWrite(file,JSON.stringify(audit,null,2)+'\n');
  return {status:audit.status,posts:audit.results,jobIds:result.jobIds};
}
