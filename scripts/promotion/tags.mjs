import {readFileSync} from 'node:fs';
import path from 'node:path';
import {publicURL} from './news.mjs';

// D6: a post may tag an artist's official account. Handles come only from the reviewed registry.
const HANDLE=/^[a-z0-9._]{1,30}$/;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
export const MAX_TAGS=2;
export const TOKEN=/\s*\[\[tag:([a-z0-9]+(?:-[a-z0-9]+)*)\]\]/g;
export const mentions = copy => [...String(copy).matchAll(/(?<![\w.@])@([A-Za-z0-9._]{1,30})/g)].map(m=>m[1].toLowerCase());

export function validateAccounts(registry) {
  if(!registry||registry.version!==1||!Array.isArray(registry.accounts))throw new Error('Artist account registry must be version 1 with an accounts list.');
  const seen=new Set();
  for(const entry of registry.accounts) {
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.artistId||'')||!['threads','instagram'].includes(entry.platform)||!HANDLE.test(entry.handle||''))throw new Error('Artist account entries need artistId, platform and a lowercase handle.');
    publicURL(entry.source);
    if(!DAY.test(entry.checkedAt||'')||!entry.sourceNote?.trim())throw new Error(`${entry.artistId}: record the official source note and the date it was checked.`);
    const key=`${entry.artistId}:${entry.platform}`;
    if(seen.has(key))throw new Error(`${key}: one official account per artist and platform.`);
    seen.add(key);
  }
  return registry;
}
export function loadAccounts(root) {
  let registry={version:1,accounts:[]};
  try{registry=JSON.parse(readFileSync(path.join(root,'promotion/artist-accounts.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  return validateAccounts(registry);
}
export function accountsFor(registry,artistIds,platforms=['threads','instagram']) {
  return registry.accounts.filter(a=>artistIds.includes(a.artistId)&&platforms.includes(a.platform)).map(({artistId,platform,handle})=>({artistId,platform,handle}));
}
// Drafts are shared between platforms, so they mark a tag position with [[tag:artist-id]].
export function validateTagTokens(copy,artistIds) {
  const tokens=[...String(copy).matchAll(TOKEN)].map(m=>m[1]);
  if(tokens.some(id=>!artistIds.includes(id)))throw Object.assign(new Error('Tag tokens may name only the artists this post is about.'),{captionRevision:true});
  if(new Set(tokens).size!==tokens.length||tokens.length>MAX_TAGS)throw Object.assign(new Error(`Tag each artist once, at most ${MAX_TAGS} tags.`),{captionRevision:true});
  if(mentions(String(copy).replace(TOKEN,'')).length)throw Object.assign(new Error('Write tags as [[tag:artist-id]]; the runner fills in the recorded handle.'),{captionRevision:true});
}
export function renderTags(copy,platform,artistIds,registry) {
  const tags=[];
  const text=String(copy).replace(TOKEN,(_,id)=>{
    const account=accountsFor(registry,artistIds,[platform]).find(a=>a.artistId===id);
    if(!account)return '';
    tags.push({artistId:id,handle:account.handle});
    return ` (@${account.handle})`;
  }).replace(/ +([,.;:!?])/g,'$1');
  return {copy:text,tags};
}
// Deterministic gate on every final caption: each mention is a recorded tag for this post.
export function validateTags(copy,tags=[]) {
  if(!Array.isArray(tags)||tags.length>MAX_TAGS||tags.some(t=>!HANDLE.test(t?.handle||'')||!t.artistId))throw new Error('Invalid tag record.');
  const allowed=new Set(tags.map(t=>t.handle));
  const found=mentions(copy);
  if(found.some(handle=>!allowed.has(handle))||new Set(found).size!==found.length||found.length!==allowed.size)throw new Error('Caption mentions must match the recorded official artist tags exactly once.');
}
// Send-time check: a handle removed from the registry, or moved to another artist, is no longer approved.
export function tagsStillRecorded(post,registry) {
  for(const tag of post.tags||[])if(!accountsFor(registry,post.artistIds||[],[post.platform]).some(a=>a.artistId===tag.artistId&&a.handle===tag.handle))throw new Error('A tagged account is no longer in the official account registry; prepare a new reviewed caption.');
}
