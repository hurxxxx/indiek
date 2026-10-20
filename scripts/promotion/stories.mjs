import {readFileSync} from 'node:fs';
import path from 'node:path';
import {askJSON,instructions} from '../editorial/ai.mjs';
import {loadStories,storyDigest} from '../editorial/content.mjs';
import {atomicWrite,hash,payloadParts,validatePost,verifyLive} from './core.mjs';
import {dailySlots,koreanDay,validateNewsVoice} from './news.mjs';

export function storyCandidate(items,posts,recent=[]) {
  return items.filter(i=>i.kind==='story'&&!posts.some(p=>p.storyId===i.id&&!['expired','superseded'].includes(p.status))&&!recent.some(p=>p.copy?.includes(i.path))).sort((a,b)=>b.published.localeCompare(a.published))[0];
}
export async function prepareStory({root,config,store,catalogue,recentPosts=[],now=new Date(),ask=(stage,prompt)=>askJSON(root,stage,prompt,{timeout:180000})}) {
  const slots=dailySlots(now).map(s=>({...s,id:s.id.replace(/-news$/,'-story')})),day=koreanDay(new Date(slots[0].scheduledAt));
  const active=p=>!['expired','superseded'].includes(p.status);
  if(store.posts.some(p=>p.kind==='story'&&active(p)&&koreanDay(new Date(p.scheduledAt))===day))return {status:'story-already-prepared',day};
  const item=storyCandidate(catalogue.items,store.posts,recentPosts);
  if(!item)return null;
  const story=loadStories(root).find(s=>s.id===item.id&&s.status==='published');
  if(!story||storyDigest(story)!==item.revision)throw new Error('Published story differs from this checkout; sync before preparing its social post');
  const voice=readFileSync(path.join(root,'promotion/voice.md'),'utf8');
  const prompt=`${instructions(root)}\n${voice}\nCreate one short English own-account post for this published indiek story. Give a concrete reason to read; do not write a news announcement or a slogan. No invented first-person listening or promotional fan/nonprofit promises. No bullets or hashtag blocks. Plain one or two sentences, at most 300 characters, no URL in the draft (runner adds it). Match the user preference for relaxed unforced language. Use only the approved article's facts, no new claims. Article: ${JSON.stringify(story)}. Recent posts: ${JSON.stringify(recentPosts.slice(0,12))}`;
  const draft=await ask('social',prompt);
  validateNewsVoice(draft.copy);
  if(draft.copy.length>300||/https?:\/\//.test(draft.copy))throw new Error('Story caption needs a shorter link-free draft');
  const audit={day,storyId:item.id,revision:item.revision,draft,posts:[],checkedAt:now.toISOString()};
  const file=path.join(root,`promotion/state/stories/${day}.json`);
  atomicWrite(file,JSON.stringify(audit,null,2)+'\n');
  for(const slot of slots) {
    const occupied=[...config.previousPosts,...recentPosts,...store.posts].some(p=>p.platform===slot.platform&&active(p)&&koreanDay(new Date(p.publishedAt||p.scheduledAt))===day&&(p.status!=='ready'||p.attemptedAt||p.containerId));
    if(occupied){audit.posts.push({platform:slot.platform,status:'skipped',reason:'A post already exists or was attempted on this Korean day'});continue;}
    const url=`${config.origin}${item.path}?from=${slot.platform}`,copy=`${draft.copy.trim()}\n\n${url}`;
    const review=await ask('social',`${instructions(root)}\n${voice}\nIndependently check this EXACT final ${slot.platform} caption against the published article and recent actual posts. Reject unsupported facts, borrowed wording, generic praise, invented experience, misleading currentness, repetitive hooks and a request to visit without a useful detail. Do not rewrite: return identical copy, approval and specific reasons/issues. Article: ${JSON.stringify(story)}. Recent posts: ${JSON.stringify(recentPosts)}. Final copy: ${JSON.stringify(copy)}`);
    if(!review.approved||review.issues.length||review.copy!==copy){audit.posts.push({platform:slot.platform,status:'rejected',review});continue;}
    const post={...slot,kind:'story',storyId:item.id,storyRevision:item.revision,artistIds:item.artistIds,url,imageUrl:config.origin+item.image,altText:item.altText,sourceDescription:item.description,copy,review,status:'ready'};
    post.payloadHash=hash(payloadParts(post));validatePost(post,config);await verifyLive(post);
    for(const old of store.posts.filter(p=>p.platform===slot.platform&&p.status==='ready'&&!p.containerId&&!p.attemptedAt&&koreanDay(new Date(p.scheduledAt))===day)){old.status='superseded';old.issue='Published magazine story selected for this slot';store.save(old,'기사 우선 예약');}
    store.save(post,'공개 기사와 최종 문안 검수 · 자체 제작 글자 이미지로 예약');
    audit.posts.push({platform:slot.platform,status:'ready',id:post.id,copy,review});
  }
  atomicWrite(file,JSON.stringify(audit,null,2)+'\n');
  return {day,status:audit.posts.some(p=>p.status==='ready')?'story-prepared':'story-held',reason:'Exact decisions recorded in promotion/state/stories'};
}
