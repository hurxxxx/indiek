import {escapeHTML as e,imageHTML,youtubeConsentHTML,saveButton} from '../site/shared.mjs';
import {storyPath,storyMinutes} from '../site/stories.mjs';
import {shareImagePath} from '../site/editorial.mjs';
import {storyDigest} from './editorial/content.mjs';

export function storyViews({stories,authors,media,tracks,pick}) {
  const cover=(s,priority=false)=>s.cover?`<figure class="story-cover">${imageHTML(media,s.cover.file,s.cover.alt,{priority,sizes:'(max-width: 760px) 90vw, 560px'})}<figcaption>${e(s.cover.caption)} <a href="/about/#image-${s.cover.file.replace(/\.[^.]+$/,'')}">Image credit</a></figcaption></figure>`:'';
  const meta=s=>`<span class="mono">${e(s.category.toUpperCase())} / ${storyMinutes(s)} MIN READ</span>`;
  const card=s=>`<article class="story-card">${meta(s)}<h2><a href="${storyPath(s)}">${e(s.title)}</a></h2><p>${e(s.description)}</p><time class="mono" datetime="${s.published}">${s.published}</time></article>`;
  function home() {
    if(!stories.length)return '';
    const [lead,...recent]=stories;
    return `<section class="magazine-cover wrap" aria-labelledby="cover-title"><div class="cover-copy"><p class="eyebrow">FROM THE MAGAZINE</p>${meta(lead)}<h2 id="cover-title"><a href="${storyPath(lead)}">${e(lead.title)}</a></h2><p class="cover-deck">${e(lead.description)}</p><a class="underlink" href="${storyPath(lead)}">Read the story <span aria-hidden="true">↗</span></a></div>${cover(lead,true)}</section>${recent.length?`<section class="wrap recent-stories"><div class="section-heading"><h2>Recent stories.</h2><a class="underlink" href="/stories/">All stories ↗</a></div><div class="story-grid">${recent.slice(0,3).map(card).join('')}</div></section>`:`<div class="wrap magazine-index-link"><a class="underlink" href="/stories/">Stories &amp; listening notes ↗</a></div>`}`;
  }
  const index=`<main id="main" class="wrap story-index"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">indiek</a><span aria-hidden="true">/</span><span>Stories</span></nav><header class="guide-heading"><p class="eyebrow">THE MAGAZINE</p><h1>A little closer<br>to the music.</h1><p class="guide-lead">The choices behind a song, the people around it, and places it might take you next.</p></header>${stories[0]?`<section class="story-index-feature">${card(stories[0])}${cover(stories[0],true)}</section>`:''}${stories.length>1?`<div class="story-grid">${stories.slice(1).map(card).join('')}</div>`:''}<aside class="story-index-footer"><a class="underlink" href="/notes/first-listens/">Explore the listening guides ↗</a><a class="underlink" href="/about/#contribute">Have a story in mind? ↗</a><a class="underlink" href="/feed.xml">Follow via RSS ↗</a></aside></main>`;
  function article(s) {
    const author=authors.find(a=>a.id===s.authorId);
    const sourceRefs=b=>(b.sources||[]).map(ref=>{const source=s.sources.find(x=>x.id===ref);return `<a class="story-source-ref" href="#source-${ref}" aria-label="Source: ${e(source.label)}">[${s.sources.indexOf(source)+1}]</a>`;}).join(' ');
    const body=s.blocks.map(b=>{
      if(b.type==='heading')return `<h2>${e(b.text)}</h2>`;
      if(b.type==='listen'){
        const r=tracks.find(t=>t.id===b.trackId);
        return `<aside class="story-listen" aria-label="Listen to ${e(r.track)}"><p class="eyebrow">LISTEN ALONG</p><h2>${e(r.track)}</h2><p>${e(r.artist)} · ${e(r.performance||r.videoType)}</p><div class="story-listen-actions"><button class="underlink" data-load-player="${r.id}" data-js-only hidden>Agree &amp; play</button>${r!==pick?saveButton(r,true):''}<a class="underlink" href="/artists/${r.id}/">Meet the artist ↗</a></div>${youtubeConsentHTML()}</aside>`;
      }
      return `<p>${e(b.text)}${b.sources.length?` <span class="story-source-refs">${sourceRefs(b)}</span>`:''}</p>`;
    }).join('\n');
    const related=stories.filter(x=>x.id!==s.id).sort((a,b)=>Number(b.artistIds.some(id=>s.artistIds.includes(id)))-Number(a.artistIds.some(id=>s.artistIds.includes(id)))).slice(0,2);
    return `<main id="main" class="wrap story-page" data-story-id="${s.id}" data-story-revision="${storyDigest(s)}"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">indiek</a><span aria-hidden="true">/</span><a href="/stories/">Stories</a></nav><article><header class="story-heading">${meta(s)}<h1>${e(s.title)}</h1><p class="story-deck">${e(s.description)}</p><p class="editorial-byline mono">BY <a href="${author.url}">${e(author.name)}</a> / <time datetime="${s.published}">${s.published}</time>${s.updated!==s.published?` / UPDATED ${s.updated}`:''}</p><div class="share-tools"><button class="underlink" data-share-page data-js-only hidden>Share this story ↗</button><a class="underlink" href="/feed.xml">Follow via RSS ↗</a></div></header>${cover(s,true)}<div class="story-body">${body}<section class="story-sources" aria-labelledby="story-sources-title"><h2 id="story-sources-title">Sources &amp; further reading</h2><ol>${s.sources.map(source=>`<li id="source-${source.id}"><a href="${e(source.url)}" target="_blank" rel="noopener noreferrer">${e(source.label)}</a><span>${e(source.publisher)}${source.language?` · ${e(source.language)}`:''}</span></li>`).join('')}</ol><p class="story-process">${author.type==='Organization'?'This feature uses AI-assisted research, drafting and automated checks. Original reporting is credited above.':'Original reporting and further reading are credited above.'} <a href="/about/#editorial">How we research and edit</a>. For a correction, email <a href="mailto:gw@lumejs.com">gw@lumejs.com</a>.</p></section></div></article>${related.length?`<section class="recent-stories"><h2>Keep reading.</h2><div class="story-grid">${related.map(card).join('')}</div></section>`:''}<nav class="story-index-footer"><a class="underlink" href="/stories/">All stories ↗</a><a class="underlink" href="/notes/first-listens/">Find another song ↗</a></nav></main>`;
  }
  return {home,index,article};
}
export const storyPromotion=s=>({id:s.id,kind:'story',title:s.title,path:storyPath(s),description:s.description,artistIds:s.artistIds,image:shareImagePath(storyPath(s)),altText:`${s.title} — indiek. Original typographic article card.`,revision:storyDigest(s),published:s.published});
