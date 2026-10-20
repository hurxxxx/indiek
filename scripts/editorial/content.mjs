import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import path from 'node:path';

export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export function storyDigest(story) {
  const {review,status,...content} = story;
  return digest(content);
}
export function skillRevision(root) {
  return digest(['SKILL.md','references/editing.md','references/benchmarks.json'].map(file => readFileSync(path.join(root,'skills/indiek-editorial',file),'utf8')).join('\n'));
}
export function loadStories(root) {
  const dir=path.join(root,'content/stories');
  return existsSync(dir) ? readdirSync(dir).filter(f=>f.endsWith('.json')).sort().map(f=>JSON.parse(readFileSync(path.join(dir,f),'utf8'))) : [];
}
const id = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0,10) === value;
export function validateStory(s,{authors,tracks,approved=false}={}) {
  if(!s||!id(s.id)||s.slug!==s.id||!['draft','published'].includes(s.status))throw new Error('Invalid story identity or state');
  if(!['Song stories','Listening paths','Scenes & people'].includes(s.category))throw new Error('Unknown story category');
  if(!date(s.published)||!date(s.updated)||s.updated<s.published)throw new Error('Invalid story dates');
  for(const k of ['title','description','authorId'])if(typeof s[k]!=='string'||!s[k].trim())throw new Error(`Missing story ${k}`);
  if(!authors.some(a=>a.id===s.authorId))throw new Error('Unknown author');
  for(const k of ['artistIds','keywords'])if(!Array.isArray(s[k])||s[k].some(v=>typeof v!=='string'))throw new Error(`Invalid ${k}`);
  if(!Array.isArray(s.sources)||!s.sources.length||new Set(s.sources.map(x=>x.id)).size!==s.sources.length)throw new Error('Story needs distinct sources');
  for(const source of s.sources) {
    if(!id(source.id)||!source.label?.trim()||!source.publisher?.trim()||!date(source.checked))throw new Error('Incomplete source attribution');
    const u=new URL(source.url);if(u.protocol!=='https:'||u.username||u.password)throw new Error('Invalid source URL');
  }
  if(!Array.isArray(s.blocks)||!s.blocks.length)throw new Error('Empty article');
  for(const b of s.blocks) {
    if(!['paragraph','heading','listen'].includes(b.type))throw new Error('Unsupported article block');
    if(b.type==='listen') {
      if(!tracks.some(t=>t.id===b.trackId&&!t.externalOnly))throw new Error('Unverified story track');
    }else if(typeof b.text!=='string'||!b.text.trim())throw new Error('Empty text block');
    if(!Array.isArray(b.sources)||b.sources.some(ref=>!s.sources.some(x=>x.id===ref)))throw new Error('Unknown block source');
  }
  if(approved) {
    const r=s.review;
    if(!r||r.contentHash!==storyDigest(s)||!r.skillRevision||!Number.isFinite(Date.parse(r.checkedAt))||r.facts?.approved!==true||r.editorial?.approved!==true||!Array.isArray(r.facts.issues)||!Array.isArray(r.editorial.issues)||r.facts.issues.length||r.editorial.issues.length)throw new Error('Story is unreviewed or changed after review');
    if(!r.editorial.contribution?.trim()||!r.editorial.referenceIds?.length)throw new Error('Editorial judgment missing');
    const urls=new Set(r.facts.checkedURLs);
    if(s.sources.some(source=>!urls.has(source.url)))throw new Error('Review did not check all published sources');
    if(!r.facts.supportedClaims?.length)throw new Error('Review lacks claim-level evidence');
  }
  return s;
}
