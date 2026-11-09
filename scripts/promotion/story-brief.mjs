import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {publicURL} from './news.mjs';

// An explicit story-now request can select a photograph. Scheduled posts never read briefs.
export function validateStoryBrief(brief,storyId) {
  if(!brief||brief.storyId!==storyId||!brief.direction?.trim()||brief.direction.length>3000)throw new Error('Story brief must match the requested article.');
  const m=brief.media;
  if(!m||!m.altText?.trim()||m.altText.length>1000||!m.credit?.trim()||m.credit.length>150||!m.credit.includes(m.creator)||!m.creator?.trim()||!m.publisher?.trim())throw new Error('Story photograph needs accurate alt text and source credit.');
  for(const u of [m.url,m.sourceURL])publicURL(u);
  if(!/^[a-f0-9]{64}$/.test(m.sha256)||!Number.isInteger(m.width)||!Number.isInteger(m.height)||m.width<320||m.width>1440||m.width/m.height<0.8||m.width/m.height>1.91)throw new Error('Story photograph needs a checked JPEG hash and supported dimensions.');
  if(!['licensed','unconfirmed'].includes(m.rightsStatus)||!m.rightsNote?.trim()||!m.authorization?.request?.trim()||m.authorization.basis!=='explicit-user-request'||!Number.isFinite(Date.parse(m.authorization.requestedAt)))throw new Error('Record photograph rights separately from the explicit publication request.');
  return brief;
}

export async function verifyStoryPhoto(media,fetcher=fetch,{cacheDirectory}={}) {
  const response=await fetcher(publicURL(media.url),{redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok||!response.headers.get('content-type')?.includes('image/jpeg'))throw new Error('Requested photograph is not a public JPEG.');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>8*1024*1024||createHash('sha256').update(bytes).digest('hex')!==media.sha256)throw new Error('Requested photograph changed after review.');
  let file;
  if(cacheDirectory){mkdirSync(cacheDirectory,{recursive:true});file=path.join(cacheDirectory,`${media.sha256}.jpg`);writeFileSync(file,bytes,{mode:0o600});}
  return {url:media.url,sha256:media.sha256,bytes:bytes.length,...(file?{file}:{})};
}
