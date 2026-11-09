// Official APIs only. Tokens never enter prompts, command arguments or request logs.
export class MetaError extends Error {
  constructor(status,code,{platform,operation,apiMessage}={}) {
    super('Meta API request failed');
    this.platform=['threads','instagram'].includes(platform)?platform:undefined;
    this.operation=['identity','recent','create','container','publish','media','carousel-item','conversation','mentions','search','reply','reply-quota','scopes'].includes(operation)?operation:undefined;
    this.status=Number(status)||0;this.code=Number(code)||0;
    const context=[this.platform,this.operation].filter(Boolean).join(' ');
    // Only recognize a fixed diagnostic; never log arbitrary API messages or request data.
    const detail=apiMessage==='API access blocked.'?'API access blocked. Check Meta developer account verification and app restrictions.':'Check account authorization or platform status.';
    this.safeMessage=`${context?context+': ':''}Meta API HTTP ${Number(status)||0}, code ${Number(code)||0}. ${detail}`;
    this.pausePlatform=[401,403,429].includes(status)||[4,10,190,200,368].includes(code);
  }
}
export function metaClient(platform,credentials,{fetcher=fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
  if(!['threads','instagram'].includes(platform)||!credentials?.token||!/^\d+$/.test(credentials.userId||''))throw new Error(`${platform}: account credentials missing`);
  const version=platform==='threads'?'v1.0':credentials.version||'v26.0';
  if(!/^v\d+\.\d+$/.test(version))throw new Error('Invalid API version');
  const host=platform==='threads'?'https://graph.threads.com':'https://graph.instagram.com';
  const base=`${host}/${version}`;
  async function request(endpoint,params={},method='GET',operation) {
    const url=new URL(`${base}/${endpoint}`);
    if(method==='GET')url.search=new URLSearchParams(params).toString();
    let response;
    try{response=await fetcher(url,{method,redirect:'error',headers:{Authorization:`Bearer ${credentials.token}`,...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded'}:{})},...(method==='POST'?{body:new URLSearchParams(params)}:{}),signal:AbortSignal.timeout(20000)});}
    catch{throw new MetaError(0,0,{platform,operation});}
    const data=await response.json().catch(()=>null);
    if(!response.ok||data?.error||!data)throw new MetaError(response.status,data?.error?.code,{platform,operation,apiMessage:data?.error?.message});
    return data;
  }
  const textField=platform==='threads'?'text':'caption';
  const fields=`id,${textField},permalink,timestamp`;
  const id=credentials.userId;
  // A carousel is one post: child containers first, then one parent with the caption (Instagram only).
  async function carousel(post) {
    if(platform!=='instagram')throw new Error('Carousels are an Instagram format.');
    const children=[];
    for(const slide of post.slides)children.push((await request(`${id}/media`,{image_url:slide.imageUrl,is_carousel_item:'true',alt_text:slide.altText},'POST','carousel-item')).id);
    if(children.some(child=>!/^\d+$/.test(String(child||''))))throw new Error('Carousel item container ID missing.');
    for(const child of children) {
      let status;
      for(let attempt=0;attempt<6&&status!=='FINISHED';attempt++){
        status=(await request(child,{fields:'status_code'},'GET','container')).status_code;
        if(['ERROR','EXPIRED'].includes(status))throw new Error(`Carousel item ${status}.`);
        if(status!=='FINISHED')await sleep(10000);
      }
      if(status!=='FINISHED')throw new Error('Carousel items are still processing; no parent container created.');
    }
    return request(`${id}/media`,{media_type:'CAROUSEL',children:children.join(','),caption:post.copy},'POST','create');
  }
  const threadFields='id,text,username,permalink,timestamp,is_reply,is_reply_owned_by_me,root_post,replied_to,hide_status';
  // Threads conversation endpoints (growth plan W8). Each needs its own permission; see engage.mjs.
  const threadsEngagement=platform!=='threads'?{}:{
    scopes:()=>request('debug_token',{input_token:credentials.token},'GET','scopes'),
    profile:()=>request(id,{fields:'id,username,threads_biography'},'GET','identity'),
    replyQuota:()=>request(`${id}/threads_publishing_limit`,{fields:'reply_quota_usage,reply_config'},'GET','reply-quota'),
    async conversation(mediaId){return (await request(`${mediaId}/conversation`,{fields:threadFields,reverse:'false',limit:'100'},'GET','conversation')).data||[];},
    async mentions(since){return (await request(`${id}/mentions`,{fields:threadFields,limit:'50',...(since?{since:String(since)}:{})},'GET','mentions')).data||[];},
    async search(q,{since,limit=25}={}){return (await request('keyword_search',{q,search_type:'RECENT',fields:threadFields,limit:String(limit),...(since?{since:String(since)}:{})},'GET','search')).data||[];},
    reply:(replyToId,text)=>request(`${id}/threads`,{media_type:'TEXT',text,reply_to_id:replyToId},'POST','reply'),
    thread:mediaId=>request(mediaId,{fields:threadFields},'GET','media'),
  };
  return {
    ...threadsEngagement,
    pollInterval:platform==='threads'?30000:60000,
    identity:()=>request(id,{fields:'id,username'},'GET','identity'),
    create:post=>post.kind==='carousel'?carousel(post):request(`${id}/${platform==='threads'?'threads':'media'}`,platform==='threads'
      ?(post.kind==='news'?{media_type:'TEXT',text:post.copy,link_attachment:post.url}:{media_type:'IMAGE',image_url:post.imageUrl,text:post.copy,alt_text:post.altText,topic_tag:'Korean music'})
      :{image_url:post.imageUrl,caption:post.copy,alt_text:post.altText},'POST','create'),
    async container(containerId){const field=platform==='threads'?'status':'status_code';return (await request(containerId,{fields:field},'GET','container'))[field];},
    publish:containerId=>request(`${id}/${platform==='threads'?'threads_publish':'media_publish'}`,{creation_id:containerId},'POST','publish'),
    media:mediaId=>request(mediaId,{fields},'GET','media'),
    async recent(){return (await request(`${id}/${platform==='threads'?'threads':'media'}`,{fields,limit:'50'},'GET','recent')).data||[];},
  };
}
export async function recentOwnPosts(config,credentials,{client=metaClient}={}) {
  const batches=await Promise.all(config.platforms.map(async platform=>{
    if(!credentials[platform]?.token)return [];
    const api=client(platform,credentials[platform]);
    const identity=await api.identity();
    if(identity.username?.toLowerCase()!==config.account.toLowerCase())throw new Error(`${platform}: recent-post account does not match ${config.account}.`);
    const posts=await api.recent();
    if(!Array.isArray(posts))throw new Error(`${platform}: recent public-post history is unavailable.`);
    // Whitelist public post fields. Credentials, response metadata and unrelated API fields never enter prompts.
    return posts.map(post=>{
      if(!post.id||typeof post.permalink!=='string'||!Number.isFinite(Date.parse(post.timestamp)))throw new Error(`${platform}: incomplete recent-post history.`);
      return {platform,id:String(post.id),copy:String(post.text??post.caption??''),permalink:post.permalink,publishedAt:post.timestamp};
    });
  }));
  return batches.flat();
}
export async function refreshToken(platform,credential,fetcher=fetch,now=new Date()) {
  if(!credential?.token)return false;
  if(!Number.isFinite(Date.parse(credential.expiresAt)))throw new Error(`${platform}: token expiry must be recorded`);
  if(Date.parse(credential.expiresAt)<=now.getTime())throw new Error(`${platform}: token expired; reconnect account`);
  if(Date.parse(credential.expiresAt)-now.getTime()>7*86400000)return false;
  if(!credential.issuedAt||now.getTime()-Date.parse(credential.issuedAt)<86400000)throw new Error(`${platform}: token cannot be refreshed yet`);
  const url=new URL(platform==='threads'?'https://graph.threads.com/refresh_access_token':'https://graph.instagram.com/refresh_access_token');
  url.search=new URLSearchParams({grant_type:platform==='threads'?'th_refresh_token':'ig_refresh_token',access_token:credential.token}).toString();
  let response;
  try{response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new Error(`${platform}: refresh unavailable`);}
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data?.access_token||!data.expires_in)throw new Error(`${platform}: refresh failed; reconnect account`);
  credential.token=data.access_token;credential.issuedAt=now.toISOString();credential.expiresAt=new Date(now.getTime()+data.expires_in*1000).toISOString();
  return true;
}
