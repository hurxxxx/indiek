import https from 'node:https';
import {lookup as dnsLookup} from 'node:dns/promises';
import {isIP} from 'node:net';

const DAY=86400000;
export const koreanDay = date => new Date(date.getTime()+9*3600000).toISOString().slice(0,10);
export function dailySlots(now=new Date()) {
  let day=koreanDay(now);
  if(now.getTime()>=Date.parse(`${day}T10:00:00+09:00`))day=koreanDay(new Date(now.getTime()+DAY));
  return ['threads','instagram'].map(platform=>({platform,id:`${platform==='threads'?'T':'I'}-${day}-${platform==='threads'?'1000':'1015'}-news`,scheduledAt:`${day}T${platform==='threads'?'01:00':'01:15'}:00.000Z`}));
}
export function artistsForResearch(publicCatalogue,content) {
  const records=[...content.records,content.editorPick].filter(Boolean);
  const ids=[...new Set(publicCatalogue.items.filter(item=>item.kind==='artist').flatMap(item=>item.artistIds))];
  return ids.map(id=>{
    const artist=records.find(item=>item.id===id);
    if(!artist)throw new Error(`Public artist ${id} is missing from the local catalogue; sync before preparing news.`);
    return {id,name:artist.artist,korean:artist.korean||'',aliases:artist.aliases||'',profile:artist.artistSource,listeningPage:`${publicCatalogue.origin}/artists/${id}/`};
  });
}
export function publicURL(value) {
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||url.hostname==='localhost'||url.hostname.endsWith('.localhost')||url.hostname.endsWith('.local')||!url.hostname.includes('.'))throw new Error('Sources and media require a public HTTPS URL.');
  url.hash='';
  return url;
}
export function globalAddress(address) {
  const version=isIP(address);
  if(version===4){
    const [a,b,c]=address.split('.').map(Number);
    return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===0||b===168||(b===88&&c===99)))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));
  }
  // Accept global unicast only; exclude documentation and transition mechanisms.
  if(version===6)return /^[23]/i.test(address)&&!/^2001:(?:db8|0|10|20):/i.test(address)&&!/^2002:/i.test(address);
  return false;
}
export async function publicRequest(value,{method='GET',redirects=3,lookup=dnsLookup}={}) {
  const url=publicURL(value);
  const answers=await lookup(url.hostname,{all:true});
  if(!answers.length||answers.some(answer=>!globalAddress(answer.address)))throw new Error('Public source resolves to a non-public address.');
  const address=answers[0];
  // Pin the vetted address for this request so a second DNS answer cannot reach an internal service.
  const response=await new Promise((resolve,reject)=>{
    const req=https.request(url,{method,signal:AbortSignal.timeout(15000),headers:{'User-Agent':'indiek-news-check/1.0 (+https://indiek.com)','Accept':'text/html,application/json;q=0.9,*/*;q=0.5','Accept-Encoding':'identity'},lookup:(_hostname,options,callback)=>options?.all?callback(null,[address]):callback(null,address.address,address.family)},res=>{
      let size=0;const chunks=[];
      res.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024){req.destroy(new Error('Public source exceeds the verification size limit.'));return;}chunks.push(chunk);});
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString('utf8'),url:url.href}));
      res.on('error',reject);
    });
    req.setTimeout(15000,()=>req.destroy(new Error('Public source verification timed out.')));
    req.on('error',reject);req.end();
  });
  if([301,302,303,307,308].includes(response.status)){
    if(!redirects||!response.headers.location)throw new Error('Public source redirect limit reached.');
    return publicRequest(new URL(response.headers.location,url).href,{method,redirects:redirects-1,lookup});
  }
  if(response.status!==200)throw new Error(`Public source is inaccessible (HTTP ${response.status}).`);
  return response;
}
export const plain = value => String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(Number.parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&(amp|quot|apos|lt|gt|nbsp);/g,(_,n)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[n])).replace(/\s+/g,' ').trim();
export function sourceKey(value) {
  const url=publicURL(value);
  for(const key of [...url.searchParams.keys()])if(/^(utm_|fbclid$|igshid$|gclid$)/i.test(key))url.searchParams.delete(key);
  url.searchParams.sort();return url.href.replace(/\/$/,'');
}
export const normalizeTopic = value => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const eventKey = candidate => [candidate.artistId,candidate.kind,normalizeTopic(candidate.subject),candidate.eventDate||''].join('|');
function validDay(day) {return /^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;}
export function validateCandidate(candidate,artists,config,now=new Date()) {
  if(!artists.some(artist=>artist.id===candidate.artistId))throw new Error('News artist is not in the current public catalogue.');
  if(!['concert','release','live-video','interview'].includes(candidate.kind))throw new Error('Unsupported news topic.');
  if(!candidate.subject?.trim()||!candidate.headline?.trim()||!candidate.summary?.trim())throw new Error('News needs a specific subject and supported facts.');
  const today=koreanDay(now),age=(Date.parse(today)-Date.parse(candidate.publishedAt))/DAY;
  if(candidate.dateBasis==='current-event-listing'){
    const until=(Date.parse(candidate.eventDate)-Date.parse(today))/DAY;
    if(candidate.kind!=='concert'||candidate.publishedAt!==''||!Number.isFinite(until)||until<0||until>(config.news?.upcomingDays??30))throw new Error('Undated listings are limited to current concerts within the upcoming-event window.');
  }else if(candidate.dateBasis!=='publication'||!validDay(candidate.publishedAt)||age<0||age>(config.news?.maxAgeDays??14))throw new Error('Announcement is undated, future-dated or outside the freshness window.');
  if(candidate.eventDate&&!validDay(candidate.eventDate))throw new Error('Invalid event date.');
  if(candidate.kind==='concert'&&(!candidate.eventDate||candidate.eventDate<today||!candidate.timezone))throw new Error('Concert must have a current/future event date and an explicit local timezone.');
  if(candidate.eventDate&&candidate.eventDate<today&&candidate.kind==='release'&&age>7)throw new Error('Past releases need a recent announcement.');
  publicURL(candidate.source.url);publicURL(candidate.source.affiliationUrl);
  if(!['artist','label','promoter','venue','ticket-seller','original-interviewer','official-video-channel'].includes(candidate.source.relationship))throw new Error('A primary publishing relationship is required.');
  for(const quote of [candidate.source.quote,candidate.source.dateEvidence,candidate.source.affiliationQuote])if(typeof quote!=='string'||plain(quote).length<8||plain(quote).length>1000)throw new Error('News evidence must contain short, exact source excerpts.');
  if(!candidate.source.publisher?.trim()||!candidate.selectionReason?.trim())throw new Error('News source and selection reason are required.');
  if(!Number.isInteger(candidate.relevance)||candidate.relevance<0||candidate.relevance>3||!Number.isInteger(candidate.actionability)||candidate.actionability<0||candidate.actionability>3)throw new Error('Invalid news selection score.');
  return candidate;
}
export function validateCoverage(research,artists) {
  const expected=new Set(artists.map(artist=>artist.id));
  if(!Array.isArray(research.coverage)||research.coverage.length!==expected.size)throw new Error('Research must account for every current artist.');
  for(const entry of research.coverage){if(!expected.delete(entry.artistId)||!['checked','inaccessible','no-fresh-news'].includes(entry.status)||!entry.note?.trim()||!Array.isArray(entry.urls)||(entry.status!=='inaccessible'&&!entry.urls.length))throw new Error('Invalid or incomplete artist coverage.');for(const url of entry.urls)publicURL(url);}
  if(expected.size)throw new Error('Research omitted a current artist.');
}
export async function verifyCandidate(candidate,{request=publicRequest}={}) {
  const page=await request(candidate.source.url);
  if(!/text\/html|application\/(?:json|ld\+json)/i.test(page.headers['content-type']||''))throw new Error('Primary source is not readable public text.');
  const body=plain(page.body);
  if(!body.includes(plain(candidate.source.quote))||!body.includes(plain(candidate.source.dateEvidence)))throw new Error('News facts or publication date were not found on the public primary source.');
  const affiliation=sourceKey(candidate.source.url)===sourceKey(candidate.source.affiliationUrl)?page:await request(candidate.source.affiliationUrl);
  if(!plain(affiliation.body).includes(plain(candidate.source.affiliationQuote)))throw new Error('Publisher relationship evidence was not found.');
  return {checkedAt:new Date().toISOString(),sourceURL:page.url,affiliationURL:affiliation.url,method:'direct public text + independent live review',evidence:body,affiliationEvidence:plain(affiliation.body)};
}
const usedStatuses=new Set(['ready','creating','created','publishing','submitted','published','held']);
export function duplicateNews(candidate,posts) {
  const topic=eventKey(candidate),url=sourceKey(candidate.source.url);
  return posts.some(post=>post.kind==='news'&&usedStatuses.has(post.status)&&(post.topicKey===topic||sourceKey(post.news.source.url)===url||(post.news.artistId===candidate.artistId&&post.news.kind===candidate.kind&&post.news.eventDate===candidate.eventDate&&normalizeTopic(post.news.subject)===normalizeTopic(candidate.subject))));
}
export function rankNews(candidates,posts,now=new Date()) {
  const recent=new Set(posts.filter(post=>usedStatuses.has(post.status)&&Date.parse(post.publishedAt||post.scheduledAt)>now.getTime()-3*DAY).flatMap(post=>post.artistIds||[]));
  return [...candidates].sort((a,b)=>{
    const score=c=>c.relevance*3+c.actionability*2+(c.dateBasis==='current-event-listing'?2:Math.max(0,7-(Date.parse(koreanDay(now))-Date.parse(c.publishedAt))/DAY))-(recent.has(c.artistId)?3:0);
    return score(b)-score(a)||b.publishedAt.localeCompare(a.publishedAt)||eventKey(a).localeCompare(eventKey(b));
  });
}
export function validateNewsVoice(copy) {
  if(typeof copy!=='string'||copy.length<25||Array.from(copy).length>350||copy.split('\n').length>4)throw new Error('News copy must be 25–350 characters in at most four lines.');
  if(/https?:|www\.|^\s*[-*#•]|\*\*|```|[🔥🚀✨]|\b(?:non.?profit|non.?commercial|fan ?site|fan project)\b/im.test(copy))throw new Error('News copy contains unsupported links, formatting or positioning.');
  if(/\b(?:hidden gem|must[- ]listen|game[- ]changer|dive into|delve into|sonic journey|something for everyone|you won.t want to miss|don.t sleep on|hits different|mark your calendars|calling all|link in bio|like and share)\b/i.test(copy))throw new Error('News copy contains a stock promotional phrase.');
  if(/\b(?:i|we)(?:['’]ve)? (?:saw|watched|heard|met|remember|listened|grew up)|\bmy (?:first|favorite|favourite)\b/i.test(copy))throw new Error('Do not invent personal listening history.');
}
export function selectedMedia(candidate,registry,now=new Date()) {
  const media=registry.find(item=>item.topicKey===eventKey(candidate));
  if(!media)return null;
  publicURL(media.url);publicURL(media.provenanceURL);
  if(!['owned','permission','licensed'].includes(media.rights)||!media.rightsNote?.trim()||!media.approvedBy?.trim()||!validDay(media.approvedAt)||media.approvedAt>koreanDay(now)||!media.altText?.trim())throw new Error('Instagram media needs recorded permission, provenance and approval.');
  if(media.expiresAt&&(!validDay(media.expiresAt)||media.expiresAt<koreanDay(now)))return null;
  return media;
}
export async function verifyNewsMedia(media,{request=publicRequest}={}) {
  const response=await request(media.url,{method:'HEAD'});
  if(!/^image\/jpeg(?:;|$)/i.test(response.headers['content-type']||''))throw new Error('Approved Instagram media is not a public JPEG.');
}
export function supersedeStaticJobs(store,now=new Date()) {
  for(const post of store.posts){
    if(post.kind!=='news'&&post.status==='ready'&&!post.containerId&&!post.attemptedAt&&Date.parse(post.scheduledAt)>now.getTime()){
      post.status='superseded';post.issue='Daily verified artist-news policy replaced this unattempted static introduction.';store.save(post,'일일 아티스트 소식 정책으로 미전송 예약 대체');
    }
  }
}
