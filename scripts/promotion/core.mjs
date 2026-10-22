import {readFileSync,writeFileSync,renameSync,mkdirSync,openSync,closeSync,fsyncSync,existsSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {publicURL,validateCandidate,validateNewsVoice,verifyCandidate,verifyNewsMedia,eventKey,selectedMedia,plain,koreanDay} from './news.mjs';

export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const payloadParts = post => post.kind==='news'?[post.platform,post.url,post.imageUrl,post.copy,post.altText,post.news,post.review,post.sourceVerification,post.media]:post.kind==='story'?[post.platform,post.url,post.imageUrl,post.copy,post.altText,post.storyId,post.storyRevision,post.review]:post.kind==='page'?[post.platform,post.url,post.imageUrl,post.copy,post.altText,post.pageKind,post.pageId,post.pageRevision,post.artistIds,post.review]:[post.platform,post.url,post.imageUrl,post.copy,post.altText];
export function atomicWrite(file, value) {
  mkdirSync(path.dirname(file),{recursive:true});
  const tmp=`${file}.${process.pid}.tmp`;
  const fd=openSync(tmp,'w',0o600);
  try {writeFileSync(fd,value);fsyncSync(fd);} finally {closeSync(fd);}
  renameSync(tmp,file);
}
export async function withLock(directory, task) {
  mkdirSync(directory,{recursive:true});const lock=path.join(directory,'runner.lock');
  let fd;
  try {fd=openSync(lock,'wx',0o600);} catch(error){
    if(error.code!=='EEXIST')throw error;
    const pid=Number(readFileSync(lock,'utf8'));
    if(!Number.isSafeInteger(pid)||pid<=0)throw new Error('Incomplete lock; inspect runner.lock before removing it.');
    try {process.kill(pid,0);throw new Error('Another promotion command is running.');}
    catch(check){if(check.code!=='ESRCH')throw check;}
    unlinkSync(lock);fd=openSync(lock,'wx',0o600);
  }
  writeFileSync(fd,String(process.pid));closeSync(fd);
  try{return await task();}finally{unlinkSync(lock);}
}
export function readJSON(file,fallback) {
  try{return JSON.parse(readFileSync(file,'utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw error;}
}
export class Store {
  constructor(root) {this.root=root;this.file=path.join(root,'promotion/state/queue.json');this.posts=readJSON(this.file,[]);}
  save(post, event) {
    post.updatedAt=new Date().toISOString();
    post.history ||= [];post.history.push({at:post.updatedAt,event,status:post.status});
    const index=this.posts.findIndex(p=>p.id===post.id);
    if(index<0)this.posts.push(post);else this.posts[index]=post;
    atomicWrite(this.file,JSON.stringify(this.posts,null,2)+'\n');
    this.log();
  }
  day(day) {
    const file=path.join(this.root,'promotion/state/news/days.json');
    const days=readJSON(file,[]),index=days.findIndex(item=>item.day===day.day);
    day.updatedAt=new Date().toISOString();
    if(index<0)days.push(day);else days[index]=day;
    atomicWrite(file,JSON.stringify(days,null,2)+'\n');this.log();
  }
  log() {
    const file=path.join(this.root,'docs/promotion.md');
    const start='<!-- automatic-promotion:start -->',end='<!-- automatic-promotion:end -->';
    const original=readFileSync(file,'utf8');
    const labels={ready:'준비',creating:'컨테이너 생성 중',created:'게시 준비 중',publishing:'게시 응답 확인 중',submitted:'제출 확인 · 링크 확인 대기',published:'API 게시 확인',held:'보류 · 수동 확인 필요',expired:'보류 · 예약 시간 경과',superseded:'미전송 예약 대체'};
    const days=readJSON(path.join(this.root,'promotion/state/news/days.json'),[]);
    const daily=days.map(day=>`### 일일 소식 선정 · ${day.day} · ${day.status}\n\n- 확인: ${day.updatedAt}\n- 결과: ${day.reason}\n- Instagram: ${day.instagram||'선정 전'}\n- 전체 아티스트 확인: ${(day.coverage||[]).map(item=>`${item.artistId}: ${item.status}`).join(', ')||'미완료'}\n- 검토 원문: ${(day.sources||[]).join(' · ')||'없음'}\n- 감사 기록: promotion/state/news/${day.day}.json\n`).join('\n');
    const body=`${start}\n## 자동 게시 기록\n\n서버 실행 기록. API 조회는 로그인 권한으로 확인한 결과이며 비로그인 노출이나 유입을 증명하지 않는다.\n\n`+daily+'\n'+this.posts.map(p=>`### ${p.id} · ${p.platform} · ${labels[p.status]||p.status}\n\n- 예약: ${p.scheduledAt} · 확인: ${p.updatedAt}\n- 콘텐츠: ${p.url}\n- 이미지: ${p.imageUrl||'없음 · 텍스트 게시'}\n- 대체 텍스트: ${p.altText||'해당 없음'}${p.kind==='news'?`\n- 선정: ${p.news.selectionReason}\n- 원문 게시자: ${p.news.source.publisher} · ${p.news.source.relationship}\n- 사실·문체 검토: ${p.review.reason}`:''}\n- 결과: ${p.permalink||'게시 링크 없음'}${p.remoteId?` · 게시물 ID ${p.remoteId}`:''}\n- 후속 조치: ${p.issue||'예약 시 공개 콘텐츠·인증 상태를 다시 확인'}\n\n문안:\n\n${p.copy.split('\n').map(line=>line?'> '+line:'>').join('\n')}\n\n이력: ${(p.history||[]).map(h=>`${h.at} ${h.event}`).join(' / ')}\n`).join('\n')+`${end}\n`;
    if(original.includes(start)!==original.includes(end))throw new Error('Incomplete promotion log markers; repair before publishing.');
    const next=original.includes(start)?original.slice(0,original.indexOf(start))+body+original.slice(original.indexOf(end)+end.length).replace(/^\n/,''):original.trimEnd()+'\n\n'+body;
    atomicWrite(file,next);
  }
}
export function slots(now = new Date()) {
  // UTC computation is explicit; the host can remain on UTC. All slots are KST.
  const local=new Date(now.getTime()+9*3600000);const monday=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
  return [[1,10,0,'threads'],[4,10,0,'threads'],[4,10,15,'instagram']].map(([days,hours,minutes,platform])=>{
    const when=new Date(monday.getTime()+days*86400000+(hours-9)*3600000+minutes*60000);
    return {platform,scheduledAt:when.toISOString(),id:`${platform==='threads'?'T':'I'}-${when.toISOString().slice(0,10)}-${hours}${String(minutes).padStart(2,'0')}`};
  }).filter(slot=>Date.parse(slot.scheduledAt)>=now.getTime());
}
export function eligible(items,posts,slot,config) {
  const cutoff=Date.parse(slot.scheduledAt)-config.cooldownDays*86400000;
  const recent=[...config.previousPosts,...posts].filter(p=>!['expired'].includes(p.status)&&Date.parse(p.publishedAt||p.scheduledAt)>cutoff);
  const used=new Set(recent.flatMap(p=>p.artistIds||[]));
  return items.filter(item=>item.artistIds.length&&!item.artistIds.some(id=>used.has(id)));
}
export function validateDraft(copy, sourceQuotes, source, platform) {
  if(typeof copy!=='string'||copy.length<25||copy.length>350||copy.split('\n').length>4)throw new Error('Copy must be 25–350 characters in at most four lines.');
  if(/https?:|www\.|\bindiek\.com\b|^\s*[-*#•]|\*\*|```|\b(?:non.?profit|non.?commercial|fan ?site|fan project)\b/im.test(copy))throw new Error('Copy contains unsupported links, formatting or positioning.');
  if(/\b(?:i|we)(?:['’]ve)? (?:saw|watched|heard|met|remember|listened|grew up)|\bmy (?:first|favorite|favourite)\b/i.test(copy))throw new Error('Do not invent personal listening history.');
  if(!Array.isArray(sourceQuotes)||!sourceQuotes.length||sourceQuotes.some(q=>typeof q!=='string'||q.length<8||!source.includes(q)))throw new Error('Source excerpts must be present in the published source.');
  if(!['threads','instagram'].includes(platform))throw new Error('Unsupported platform.');
}
export function validatePost(post,config) {
  if(!/^[TI]-\d{4}-\d{2}-\d{2}-\d{4}(?:-news|-story)?$/.test(post.id)||!config.platforms.includes(post.platform))throw new Error('Invalid job identity.');
  if(!Number.isFinite(Date.parse(post.scheduledAt)))throw new Error('Invalid schedule.');
  if(post.kind==='news'){
    validateCandidate(post.news,(post.artistIds||[]).map(id=>({id})),config,new Date(post.scheduledAt));
    if(post.artistIds.length!==1||post.artistIds[0]!==post.news.artistId||post.topicKey!==eventKey(post.news)||publicURL(post.url).href!==publicURL(post.news.source.url).href)throw new Error('News job identity differs from the selected primary source.');
    if(!post.review||!['approved','sourceIsPrimary','datesConfirmed','factsConfirmed','noDuplicate','voicePassed'].every(key=>post.review[key]===true)||post.review.unsupportedClaims.length||post.review.styleIssues.length||!post.review.supportedClaims.length||!post.sourceVerification?.checkedAt)throw new Error('News requires a successful independent factual and style review.');
    const suffix=`\n\n${post.url}`;
    if(typeof post.copy!=='string'||post.copy!==`${post.news.draft.trim()}${suffix}`||Array.from(post.copy).length>500)throw new Error('Invalid final news caption.');
    validateNewsVoice(post.copy.slice(0,-suffix.length));
    if(post.platform==='instagram'){
      if(!post.media||!selectedMedia(post.news,[post.media],new Date(post.scheduledAt))||post.imageUrl!==post.media.url||post.altText!==post.media.altText||post.altText.length>1000)throw new Error('Instagram news requires matching approved media.');
    }else if(post.imageUrl||post.altText||post.media)throw new Error('Threads news uses the reviewed text format.');
    if(post.payloadHash!==hash(payloadParts(post)))throw new Error('Prepared payload changed; create a reviewed replacement job.');
    return;
  }
  const url=new URL(post.url),image=new URL(post.imageUrl);
  if(url.origin!==config.origin||url.search!==`?from=${post.platform}`||url.hash||!/^\/(artists|notes|stories)\/[a-z0-9-]+\/$/.test(url.pathname))throw new Error('Post link must point to the selected indiek page.');
  if(image.origin!==config.origin||!/^\/assets\/social\/[a-z0-9-]+\.jpg$/.test(image.pathname)||image.search||image.hash)throw new Error('Media must be a published indiek sharing card.');
  if(typeof post.copy!=='string'||Buffer.byteLength(post.copy)>500||!post.copy.includes(post.url))throw new Error('Invalid final caption.');
  if(!post.altText||post.altText.length>1000||(!post.artistIds?.length&&post.kind!=='story'))throw new Error('Missing media description or artist identity.');
  if(post.kind==='story'){
    if(!/^[a-f0-9]{64}$/.test(post.storyRevision)||!post.review?.approved||post.review.issues?.length||post.review.copy!==post.copy||!post.review.reason?.trim()||url.pathname!==`/stories/${post.storyId}/`)throw new Error('Story caption needs an exact independent review');
    if(post.payloadHash!==hash(payloadParts(post)))throw new Error('Reviewed story payload changed');
  }else if(url.pathname.startsWith('/stories/'))throw new Error('Story requires article verification');
  if(post.kind==='page'){
    const section=({artist:'artists',guide:'notes'})[post.pageKind];
    if(!section||url.pathname!==`/${section}/${post.pageId}/`||!/^[a-f0-9]{64}$/.test(post.pageRevision)||post.review?.approved!==true||!Array.isArray(post.review.issues)||post.review.issues.length||post.review.copy!==post.copy||!post.review.reason?.trim()||post.mode!=='on-demand')throw new Error('Page caption needs an exact review and published-page identity.');
  }
  if(post.payloadHash!==hash(payloadParts(post)))throw new Error('Prepared payload changed; create a reviewed replacement job.');
}
export async function verifyLive(post,fetcher=fetch) {
  if(post.kind==='news'){
    await verifyCandidate(post.news);
    if(post.media)await verifyNewsMedia(post.media);
    return;
  }
  const url=new URL(post.url);url.search='';
  const response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw new Error('Source page is not public.');
  const html=await response.text();
  if(post.kind==='story'&&!html.includes(`data-story-revision="${post.storyRevision}"`))throw new Error('Article changed after caption review; prepare a new reviewed caption');
  if(!html.includes(`href="${url.href}"`)||!html.includes(post.sourceDescription.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))))throw new Error('Published source differs from the prepared selection.');
  const image=await fetcher(post.imageUrl,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!image.ok||!image.headers.get('content-type')?.includes('image/jpeg'))throw new Error('Sharing image is not public yet.');
  return {url:url.href,status:response.status,checkedAt:new Date().toISOString(),revision:post.storyRevision,htmlSHA256:createHash('sha256').update(html).digest('hex'),text:plain(html)};
}
const normalize = value => String(value||'').replace(/\r\n/g,'\n').trim();
export async function publishScheduledPost(post,{recent,...options}) {
  const {config,store,now=new Date()}=options;
  try {
    const age=now.getTime()-Date.parse(post.scheduledAt);
    if(['ready','created'].includes(post.status)&&age>=0&&age<=config.maxSlotAgeMinutes*60000) {
      const recentPosts=await recent();
      if([...config.previousPosts,...recentPosts,...store.posts.filter(p=>p.status==='published')].some(p=>p.id!==post.id&&p.platform===post.platform&&koreanDay(new Date(p.publishedAt))===koreanDay(now))) {
        post.status='superseded';post.issue='A post already exists on this platform today; no extra daily post';store.save(post,'하루 한 건 제한');return post;
      }
    }
    return await publishPost(post,{...options,now});
  } catch(error) {
    post.issue=error.safeMessage||error.message;
    if(['ready','created'].includes(post.status))post.status='held';
    if(error.pausePlatform)post.pausePlatform=true;
    // Preserve publishing/submitted: an uncertain send can only be reconciled, never resent.
    store.save(post,'전송 확인 실패 · 재전송 없이 보류');
    return post;
  }
}
export async function publishPost(post,{config,store,api,verify=verifyLive,now=new Date(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),clock=Date.now}) {
  const started=clock();
  const tooLate=()=>now.getTime()+Math.max(0,clock()-started)-Date.parse(post.scheduledAt)>config.maxSlotAgeMinutes*60000;
  const expire=()=>{post.status='expired';post.issue='지난 예약은 몰아서 게시하지 않음. 다음 계획에서 새 문안을 준비.';store.save(post,'예약 시간 경과');return post;};
  validatePost(post,config);
  if(['published','expired','superseded'].includes(post.status))return post;
  if(['publishing','submitted'].includes(post.status)) {
    let media=post.remoteId?await api.media(post.remoteId):null;
    if(!media){
      const recent=await api.recent();
      const matches=recent.filter(m=>normalize(m.text||m.caption)===normalize(post.copy)&&Date.parse(m.timestamp)>=Date.parse(post.attemptedAt)-60000);
      if(matches.length===1)media=matches[0];
    }
    if(media?.id&&media.permalink&&normalize(media.text||media.caption)===normalize(post.copy)) {
      post.remoteId=media.id;post.permalink=media.permalink;post.publishedAt=media.timestamp||now.toISOString();post.status='published';delete post.issue;store.save(post,'원격 조회로 게시 확인');
    }else{post.issue='게시 결과가 불확실함. 재전송하지 말고 계정에서 확인.';store.save(post,'재전송 없이 확인 보류');}
    return post;
  }
  if(post.status==='held'||post.status==='creating')return post;
  const age=now.getTime()-Date.parse(post.scheduledAt);
  if(age<0)return post;
  if(tooLate())return expire();
  await verify(post);
  if(tooLate())return expire();
  // Account identity is checked on every run; credentials for another account must never publish.
  const identity=await api.identity();
  if(identity.username?.toLowerCase()!==config.account)throw new Error('Connected account does not match indiekdotcom.');
  try {
    if(!post.containerId) {
      post.status='creating';store.save(post,'정확한 문안 기록 후 컨테이너 생성 요청');
      const result=await api.create(post);
      if(!result.id)throw new Error('Container ID missing.');
      post.containerId=result.id;post.status='created';store.save(post,'컨테이너 생성 확인');
    }
    let status;
    for(let attempt=0;attempt<4;attempt++) {
      status=await api.container(post.containerId);
      if(status==='FINISHED')break;
      if(status==='PUBLISHED') {post.status='publishing';post.attemptedAt ||= now.toISOString();store.save(post,'이미 게시된 컨테이너: 원격 조회 필요');return post;}
      if(['ERROR','EXPIRED'].includes(status))throw new Error(`Container ${status}.`);
      if(attempt<3)await sleep(api.pollInterval||10000);
    }
    if(status!=='FINISHED'){post.issue='미디어 처리 대기. 동일 컨테이너만 재확인.';store.save(post,'처리 대기');return post;}
    if(tooLate())return expire();
    post.status='publishing';post.attemptedAt=now.toISOString();store.save(post,'게시 요청 전 상태 저장');
    const result=await api.publish(post.containerId);
    if(!result.id)throw new Error('Published ID missing.');
    post.remoteId=result.id;post.status='submitted';store.save(post,'게시 ID 수신');
    return await publishPost(post,{config,store,api,verify,now,sleep,clock});
  }catch(error){
    if(error.pausePlatform)post.pausePlatform=true;
    post.issue=error.safeMessage||'API 응답 확인 실패. 원격 확인 전 재전송하지 않음.';
    if(post.status==='creating')post.status='held';
    store.save(post,'오류 · 중복 재전송 중단');
    return post;
  }
}
