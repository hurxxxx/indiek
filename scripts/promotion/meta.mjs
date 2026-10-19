// Official APIs only. Tokens never enter prompts, command arguments or request logs.
export class MetaError extends Error {
  constructor(status,code) {
    super('Meta API request failed');
    this.safeMessage=`Meta API HTTP ${Number(status)||0}, code ${Number(code)||0}. Check account authorization or platform status.`;
    this.pausePlatform=[401,403,429].includes(status)||[4,10,190,200,368].includes(code);
  }
}
export function metaClient(platform,credentials,{fetcher=fetch}={}) {
  if(!['threads','instagram'].includes(platform)||!credentials?.token||!/^\d+$/.test(credentials.userId||''))throw new Error(`${platform}: account credentials missing`);
  const version=platform==='threads'?'v1.0':credentials.version||'v26.0';
  if(!/^v\d+\.\d+$/.test(version))throw new Error('Invalid API version');
  const host=platform==='threads'?'https://graph.threads.com':'https://graph.instagram.com';
  const base=`${host}/${version}`;
  async function request(endpoint,params={},method='GET') {
    const url=new URL(`${base}/${endpoint}`);
    if(method==='GET')url.search=new URLSearchParams(params).toString();
    let response;
    try{response=await fetcher(url,{method,redirect:'error',headers:{Authorization:`Bearer ${credentials.token}`,...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded'}:{})},...(method==='POST'?{body:new URLSearchParams(params)}:{}),signal:AbortSignal.timeout(20000)});}
    catch{throw new MetaError(0,0);}
    const data=await response.json().catch(()=>null);
    if(!response.ok||data?.error||!data)throw new MetaError(response.status,data?.error?.code);
    return data;
  }
  const textField=platform==='threads'?'text':'caption';
  const fields=`id,${textField},permalink,timestamp`;
  const id=credentials.userId;
  return {
    pollInterval:platform==='threads'?30000:60000,
    identity:()=>request(id,{fields:'id,username'}),
    create:post=>request(`${id}/${platform==='threads'?'threads':'media'}`,platform==='threads'
      ?(post.kind==='news'?{media_type:'TEXT',text:post.copy,link_attachment:post.url}:{media_type:'IMAGE',image_url:post.imageUrl,text:post.copy,alt_text:post.altText,topic_tag:'Korean music'})
      :{image_url:post.imageUrl,caption:post.copy,alt_text:post.altText},'POST'),
    async container(containerId){const field=platform==='threads'?'status':'status_code';return (await request(containerId,{fields:field}))[field];},
    publish:containerId=>request(`${id}/${platform==='threads'?'threads_publish':'media_publish'}`,{creation_id:containerId},'POST'),
    media:mediaId=>request(mediaId,{fields}),
    async recent(){return (await request(`${id}/${platform==='threads'?'threads':'media'}`,{fields,limit:'50'})).data||[];},
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
