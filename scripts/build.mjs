import {readFileSync, writeFileSync, mkdirSync, copyFileSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {loadStories,validateStory} from './editorial/content.mjs';
import {publicStories,storyIndex,storyPath} from '../site/stories.mjs';
import {storyViews,storyPromotion} from './story-pages.mjs';
import {spawnSync} from 'node:child_process';
import {shareImagePath, editorialEntries, publishedEntries, feedXML, relatedRecords} from '../site/editorial.mjs';
import {escapeHTML as e, artistPath, imageHTML, coverHTML, videoLabel, externalLink as out, saveButton, getFeaturedArtists, getListeningGuides, guidePath, formatPosition, youtubeConsentHTML, getArtistDirectory, navigationSection} from '../site/shared.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFileSync(path.join(root, file), 'utf8');
const catalogue = JSON.parse(read('content/catalogue.json'));
const media = JSON.parse(read('content/media.json'));
const rights = JSON.parse(read('content/image-rights.json'));
const {site, records, editorPick: pick} = catalogue;
const features = getFeaturedArtists(catalogue);
const guides = getListeningGuides(catalogue);
const all = [...records, pick];
const version = '20261020-stories';
const authors=JSON.parse(read('content/authors.json'));
const stories=publicStories(loadStories(root));
for(const s of stories) {
  validateStory(s,{authors,tracks:all,approved:true});
  if(s.cover&&(!media[s.cover.file]||!rights.images.some(x=>x.file===s.cover.file)))throw new Error(`Uncredited story cover: ${s.id}`);
}
if(new Set(stories.map(s=>s.slug)).size!==stories.length||new Set(stories.map(s=>s.id)).size!==stories.length)throw new Error('Duplicate story identity');
const storyView=storyViews({stories,authors,media,tracks:all,pick});
rmSync(path.join(root,'dist/stories'),{recursive:true,force:true});
const entries = editorialEntries(catalogue, guides);
entries.push(...stories.map(s=>({id:s.id,path:storyPath(s),title:s.title,description:s.description,type:'Story',published:s.published,updated:s.updated})));
const socialImages = [];
const promotionItems = [];
const pages = [];
const find = id => all.find(r => r.id === id);
const guideMembers = guide => [...guide.records, ...(guide.moreRecords || [])];
const sourceLink = (url, label, language = '') => out(url, `${label}${language ? ` (${language})` : ''}`);
const creditId = name => `image-${name.replace(/\.[^.]+$/,'')}`;
function photoCredit(name) {
  const image = rights.images.find(image=>image.file===name);
  return image?.license || image?.showCredit ? `<a class="photo-credit" href="/about/#${creditId(name)}">Photo: ${e(image.credit)}${image.license?` · ${e(image.license)}`:''}</a>` : '';
}

function header(url) {
  const section = navigationSection(url);
  const links = [['home','/','Home'],['stories','/stories/','Stories'],['artists','/artists/','Artists'],['guides','/notes/first-listens/','Guides']];
  return `<a class="skip-link" href="#main">Skip to content</a><header class="topbar wrap">
    <a href="/" class="small-logo" aria-label="indiek home">ik<span class="logo-dot">.</span></a>
    <nav aria-label="Main navigation">${links.map(([id,href,label])=>`<a href="${href}" data-nav-section="${id}"${section===id?` aria-current="${url===href?'page':'true'}"`:''}>${label}</a>`).join('')}</nav>
    <div class="header-actions" data-js-only hidden><button class="text-button saved-link" data-library>Saved <span class="saved-count">0</span></button><button class="search-button" data-search aria-label="Find music or stories"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></button></div>
  </header>`;
}
function footer() {
  return `<footer class="footer wrap"><a class="small-logo" href="/" aria-label="indiek home">indiek.</a><span class="mono">KOREAN MUSIC. OPEN EARS.</span><div><a href="/about/">About & contact</a><a href="/privacy-and-terms/">Privacy & terms</a><a href="/feed.xml">RSS</a><a href="mailto:${site.email}">Get in touch</a><button class="analytics-settings" data-analytics-settings hidden>Analytics settings</button><span class="mono">© 2026 INDIEK</span></div></footer>`;
}
function overlays() {
  return `<section class="analytics-notice" id="analytics-notice" aria-labelledby="analytics-title" hidden><div><h2 id="analytics-title">Help improve indiek?</h2><p>Allow first-party analytics cookies and statistics about page visits, playback, saves and shares. Visitor cookies last up to 35 days. <a href="/privacy-and-terms/#analytics">Privacy details</a></p><p id="analytics-status" class="analytics-status" role="status"></p></div><div class="analytics-actions"><button data-analytics-decline>No thanks</button><button data-analytics-allow>Allow analytics</button></div></section>
  <dialog id="content-dialog" aria-labelledby="dialog-title"><div class="dialog-top"><h2 id="dialog-title">Find music</h2><button class="close-button" aria-label="Close dialog">Close <span aria-hidden="true">×</span></button></div><div id="dialog-content"></div></dialog><div class="toast" id="toast" role="status" aria-live="polite"></div>
  <div id="player-backdrop" class="player-backdrop" aria-hidden="true" hidden></div>
  <section id="persistent-player" class="persistent-player" aria-label="YouTube listening window" hidden>
    <span class="sr-only" tabindex="0" data-player-focus="start" hidden></span>
    <div class="persistent-player-heading"><div><p class="mono">NOW LISTENING</p><a data-current-track href="/#records"></a></div><button class="player-saved-toggle" data-library data-mobile-queue aria-label="Open saved tracks" hidden>Saved <span class="saved-count">0</span></button><button class="player-size-toggle" data-resize-player aria-label="Minimize and keep listening">Minimize</button><button data-unload-player aria-label="Stop and close YouTube player" title="Stop and close">×</button></div>
    <div class="persistent-player-body"><div class="persistent-player-stage" data-player-stage></div>
      <aside class="player-playlist" data-player-playlist aria-labelledby="playlist-title" hidden><div class="playlist-heading"><h2 id="playlist-title">Your saved tracks</h2><span class="mono" data-playlist-count></span></div><ol data-playlist-rows></ol><div class="playlist-footer"><p>Play all starts from the first track.<br>Auto-next follows the order shown.</p><button data-library>Manage saved tracks ↗</button></div></aside>
    </div><div class="player-transport"><div class="queue-controls" data-queue-controls hidden><button data-play-all title="Play saved tracks from the beginning">Play all</button><button data-previous-track aria-label="Previous saved track" disabled>← Previous</button><button data-next-track aria-label="Next saved track" disabled>Next →</button><button data-auto-next aria-pressed="true">Auto-next: on</button></div><div class="playback-message"><p data-playback-status role="status" aria-live="polite"></p></div></div><span class="sr-only" tabindex="0" data-player-focus="end" hidden></span>
  </section>`;
}
function page(url, title, description, main, kind = '', editorial = null) {
  const canonical = site.url + url;
  const image = shareImagePath(url);
  socialImages.push({image, title:title.replace(/ \| indiek$/, '').replace(' — Listening guide',''), subtitle:'Find your next listen at indiek.com', label:editorial ? 'Listening notes' : 'Music from Korea'});
  const structured = editorial ? {'@context':'https://schema.org','@type':'Article',headline:title,description,url:canonical,image:site.url + image,author:{'@type':editorial.authorType||'Organization',name:editorial.author,url:site.url+(editorial.authorURL||'/about/')},...(editorial.published ? {datePublished:editorial.published} : {}),dateModified:editorial.updated,mainEntityOfPage:canonical} : null;
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${site.googleSiteVerification ? `<meta name="google-site-verification" content="${e(site.googleSiteVerification)}">` : ''}
<title>${e(title)}</title><meta name="description" content="${e(description)}"><meta name="theme-color" content="#f5f3ed">
<link rel="canonical" href="${canonical}"><meta property="og:type" content="${editorial?'article':'website'}"><meta property="og:site_name" content="indiek">
<meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${canonical}">
<meta property="og:image" content="${site.url}${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${e(title)} — indiek listening notes">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(title)}"><meta name="twitter:description" content="${e(description)}"><meta name="twitter:image" content="${site.url}${image}"><meta name="twitter:image:alt" content="${e(title)} — indiek listening notes">
<link rel="alternate" type="application/rss+xml" title="indiek" href="/feed.xml">
${structured?`<script type="application/ld+json">${JSON.stringify(structured).replaceAll('<','\\u003c')}</script>`:''}
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/fonts.css"><link rel="stylesheet" href="/styles.css?v=${version}"><script type="module" src="/app.js?v=${version}"></script>
</head><body${kind ? ` class="${kind}"` : ''}><div id="page-content">${header(url)}${main}${footer()}</div>${overlays()}</body></html>\n`;
  const file = path.join(root, 'dist', url, 'index.html');
  mkdirSync(path.dirname(file), {recursive:true});
  writeFileSync(file, html.replace(/[\t ]+$/gm, ''));
  pages.push(canonical);
}
function artistCard(r) {
  const feature = features.find(feature => feature.id === r.id);
  return `<article class="artist-card" data-directory-artist="${r.id}">
    <a class="artist-card-image artist-card-image-${feature.kind}" href="${artistPath(r)}" aria-label="Meet ${e(r.artist)}">${imageHTML(media,feature.image,feature.alt,{sizes:'(max-width: 760px) 88px, (max-width: 1050px) 45vw, 30vw',style:`object-position:${feature.position}`})}</a>
    <div class="artist-card-heading"><p class="eyebrow">${e(r.genre)}</p><h2><a href="${artistPath(r)}">${e(r.artist)} <span aria-hidden="true">↗</span></a></h2><p lang="ko">${e(r.korean)}</p>${photoCredit(feature.image)}</div>
    <p class="artist-card-intro">${e(r.artistIntro)}</p>
    <div class="artist-card-track"><a href="${artistPath(r)}#listen"><span class="mono">A SONG TO START WITH</span><strong>${e(r.track)}</strong><span class="artist-card-format">${videoLabel(r)}</span></a><div class="artist-card-actions"><button class="underlink" data-load-player="${r.id}" aria-label="Agree &amp; play: ${e(r.track)} by ${e(r.artist)}" data-js-only hidden>Agree &amp; play</button>${r!==pick?saveButton(r):''}</div></div>
  </article>`;
}
function hero(feature, i) {
  const r = find(feature.id);
  return `<div class="hero-slide${i===0?' is-active':''}" id="hero-${r.id}"${i ? ' hidden aria-hidden="true" inert' : ''} role="group" aria-roledescription="slide" aria-label="${e(r.artist)}, ${i+1} of ${features.length}">
  <a class="hero-image hero-image-${r.id} hero-image-${feature.kind}" href="${artistPath(r)}" aria-label="Meet ${e(r.artist)}">${imageHTML(media,feature.image,feature.alt,{priority:i===0,deferred:i!==0,sizes:feature.kind==='artwork'?'(max-width: 760px) 48vw, 32vw':'(max-width: 760px) calc(100vw - 36px), 62vw',style:`object-position:${feature.position}`})}<span class="location-label mono">${feature.kind==='artwork'?'RELEASE ARTWORK':`${e(r.artist)} / <span lang="ko">${e(r.korean)}</span>`}</span><span class="artist-stamp" aria-hidden="true">${e(r.artist)}</span></a>
  <div class="story-caption"><div><p class="eyebrow">MEET THE ARTIST <span lang="ko">${e(r.korean)}</span></p><h2><a href="${artistPath(r)}">${e(feature.title)}</a></h2></div><a class="round-arrow" href="${artistPath(r)}" aria-label="Read about ${e(r.artist)}">↗</a></div><p class="feature-deck">${feature.deck}</p>${photoCredit(feature.image)}</div>`;
}
function trackLink(r,i) {
  return `<li><a class="track" data-room-track="${r.id}" href="${artistPath(r)}#listen" aria-label="Listen to ${e(r.track)} by ${e(r.artist)}"><span class="track-number" aria-hidden="true">${formatPosition(i+1)}</span><span class="track-info"><strong>${e(r.track)}</strong><span>${e(r.artist)}</span></span>${r.duration?`<span class="track-time">${r.duration}</span>`:''}<span class="track-play" aria-hidden="true">▷</span></a></li>`;
}
function guideCards(heading = 'h3', compact = false) {
  return `<div class="guide-grid${compact?' guide-grid-home':''}">${guides.map((guide,i)=>{
    const members = guideMembers(guide);
    const first = members[0];
    const artwork = guide.cardImageArtistId ? members.find(r=>r.id===guide.cardImageArtistId) : first;
    if (!artwork) throw new Error(`Card image artist is not in guide: ${guide.id}`);
    const preview = members.slice(0,3).map(r=>e(r.artist)).join(' · ');
    const more = members.length - 3;
    return `<article class="guide-card" data-guide="${guide.id}" data-track-count="${members.length}"><a class="guide-card-link" href="${guidePath(guide)}" aria-label="Explore the guide: ${e(guide.title)}">
      <div class="guide-card-top mono"><span>GUIDE ${formatPosition(i+1)}</span><span>${members.length} ${members.length===1?'TRACK':'TRACKS'}</span></div>
      ${compact&&stories[0]?.cover?.file===artwork.image?'':`<div class="guide-artwork">${coverHTML(media,artwork,{sizes:'(max-width: 760px) 90vw, 45vw'})}</div><p class="guide-featured">${e(artwork.artist)} / ${e(artwork.release || artwork.album)}</p>`}
      <${heading}>${e(guide.title)}</${heading}><p class="guide-description">${e(guide.description)}</p>
      <p class="guide-preview">${preview}${more>0?` <span>+ ${more} more</span>`:''}</p>
      <span class="guide-cta">Explore the guide <span aria-hidden="true">↗</span></span>
    </a></article>`;
  }).join('')}</div>`;
}
function guideTrack(r,i,guide) {
  const detail = guide?.trackDetails?.[r.id];
  const next = detail && find(detail.nextArtistId);
  return `<li${detail?' class="guide-track-expanded"':''}><a class="guide-track" href="${artistPath(r)}#listen" data-guide-track="${r.id}">
    <span class="guide-track-number mono" aria-hidden="true">${formatPosition(i+1)}</span>${coverHTML(media,r,{sizes:'(max-width: 760px) 76px, 100px'})}
    <div class="guide-track-copy"><p class="eyebrow">${e(r.artist)} / <span lang="ko">${e(r.korean)}</span></p><h2>${e(r.track)}</h2><p class="guide-track-note">${e(guide?.trackNotes?.[r.id] || r.note)}</p></div>
    <span class="guide-track-action"><span class="mono">${videoLabel(r)}</span><span>Listen & read <span aria-hidden="true">↗</span></span></span>
  </a>${detail?`<div class="guide-track-details"><p><strong>Behind the song.</strong> ${e(detail.listenFor)}</p><p><strong>You might also like:</strong> <a href="${artistPath(next)}">${e(next.artist)} / ${e(next.track)}</a>. ${e(detail.nextNote)}</p></div>`:''}<div class="guide-track-controls"><button class="underlink" data-load-player="${r.id}" data-js-only hidden>Agree &amp; play</button>${r!==pick?saveButton(r,true):''}</div></li>`;
}

function guideCatalogue(guide) {
  if (!guide.moreRecords?.length) return '';
  return `<section class="related-listening guide-catalogue" aria-labelledby="guide-catalogue-title"><p class="eyebrow">MORE TO HEAR / ${guide.moreRecords.length} ARTISTS</p><h2 id="guide-catalogue-title">More artists to spend time with.</h2><p class="guide-catalogue-intro">Folk, pop, R&B and more, from artists elsewhere in the journal. Each has a song here and a little of their story.</p><div class="related-tracks">${guide.moreRecords.map(r=>`<article data-guide-more="${r.id}"><a href="${artistPath(r)}"><h3>${e(r.artist)}</h3><span>${e(r.track)} / ${videoLabel(r)}</span><p>${e(r.artistIntro)}</p><span class="guide-catalogue-link">Meet the artist ↗</span></a><div class="guide-track-controls"><button class="underlink" data-load-player="${r.id}" data-js-only hidden>Agree &amp; play</button>${r!==pick?saveButton(r,true):''}</div></article>`).join('')}</div></section>`;
}
function player(r, cover = false) {
  if(r.externalOnly) return `<div class="external-player"><p class="eyebrow">${videoLabel(r)} · ${r.duration}</p><p>${e(r.performance)}</p>${out(r.url,'Watch live on YouTube','room-button')}<p class="embed-caption">This performance opens on YouTube.</p></div>`;
  return `<div class="player-shell${cover?' player-with-cover':''}" data-player="${r.id}">
  <div class="player-stage"><div class="player-placeholder">${cover ? coverHTML(media,r,{sizes:'(max-width: 760px) 90vw, 560px',className:'player-cover'}) : `<p class="eyebrow">${videoLabel(r)}${r.duration ? ` · ${r.duration}` : ''}</p><p>${e(r.performance || r.channel)}</p>`}<button class="video-load" data-load-player="${r.id}" data-js-only hidden><span class="play-triangle" aria-hidden="true"></span> Agree &amp; play</button></div></div>
  <div class="video-caption"><span class="mono">VIA ${e(r.channel)}</span>${out(r.url,r.videoType==='live'?'Watch live on YouTube':'Open on YouTube','underlink')}</div>
  ${youtubeConsentHTML()}
  <button class="underlink disconnect-player" data-unload-player hidden>Disconnect YouTube</button></div>`;
}
function moreTracks(r) {
  if(!r.moreTracks) return '';
  return `<aside class="artist-listens" aria-labelledby="more-listens-title"><p class="eyebrow">MORE SONGS TO EXPLORE</p><h3 id="more-listens-title">Keep listening.</h3><ol class="artist-track-links">${r.moreTracks.map((track,i)=>`<li><a href="${track.url}" target="_blank" rel="noopener noreferrer"><span class="mono">0${i+1} / ${track.year}</span><span><strong>${e(track.title)}</strong><small>${e(track.note)}</small></span><span aria-hidden="true">↗</span></a></li>`).join('')}</ol><p class="artist-listens-note mono">LISTEN ON YOUTUBE ↗</p></aside>`;
}
function editorPick() {
  return `<section class="editor-pick pick-preview wrap" id="editors-pick" aria-labelledby="editors-pick-title"><figure class="pick-artwork"><a href="${artistPath(pick)}#listen" aria-label="Listen to ${e(pick.track)} by ${e(pick.artist)}">${coverHTML(media,pick,{sizes:'(max-width: 760px) 90vw, 40vw'})}</a><figcaption>${e(pick.release || pick.album)} · Release artwork</figcaption></figure><div class="pick-copy"><p class="eyebrow">EDITOR’S PICK / R&amp;B</p><h2 id="editors-pick-title"><a href="${artistPath(pick)}">${e(pick.artist)}</a><span>${e(pick.track)} <span lang="ko">(${e(pick.koreanTitle)})</span></span></h2><p class="pick-date mono">SINGLE / ${e(pick.releaseDate.toUpperCase())}</p><div class="pick-reading"><p>${e(pick.description)}</p><div class="pick-actions"><button class="underlink" data-load-player="${pick.id}" data-js-only hidden>Agree &amp; play</button><a class="underlink" href="${artistPath(pick)}">The story behind the voice <span aria-hidden="true">↗</span></a></div>${youtubeConsentHTML()}</div></div></section>`;
}

function shareControl() { return '<div class="share-tools"><button class="underlink" data-share-page data-js-only hidden>Share this page ↗</button><a class="underlink" href="/feed.xml">Follow via RSS ↗</a></div>'; }
function byline(editorial) {
  if (!editorial) return '';
  return `<p class="editorial-byline mono">BY <a href="/about/">${e(editorial.author.toUpperCase())}</a>${editorial.published?` / PUBLISHED <time datetime="${editorial.published}">${editorial.published}</time>`:''}${editorial.updated && editorial.updated!==editorial.published?` / UPDATED <time datetime="${editorial.updated}">${editorial.updated}</time>`:''}</p>`;
}
function related(r) {
  const next = relatedRecords(r,guides);
  return `<section class="related-listening" aria-labelledby="related-title"><p class="eyebrow">WHERE TO NEXT</p><h2 id="related-title">More music you might like.</h2><div class="related-tracks">${next.records.map(other=>`<a href="${artistPath(other)}"><strong>${e(other.artist)}</strong><span>${e(other.track)}</span></a>`).join('')}</div><p class="related-guide-links">${next.guides.map(g=>`<a class="underlink" href="${guidePath(g)}">${e(g.title)} ↗</a>`).join('')}</p></section>`;
}
function latest() {
  const recent=publishedEntries(entries.filter(item=>item.type!=='Story')).slice(0,4);
  return `<section class="latest-section wrap" id="latest" aria-labelledby="latest-title"><div class="section-heading"><div><p class="eyebrow">RECENTLY ADDED</p><h2 id="latest-title">New to the journal.</h2></div><a class="underlink" href="/feed.xml">Follow via RSS ↗</a></div><div class="latest-list">${recent.map(item=>`<a href="${item.path}"><span class="mono"><time datetime="${item.published}">${item.published}</time> / ${item.type.toUpperCase()}</span><h3>${e(item.title)}</h3><p>${e(item.description)}</p><span aria-hidden="true">↗</span></a>`).join('')}</div></section>`;
}

let home = read('site/templates/home.html');
home=home.replace('{{STORIES}}',storyView.home());
for(const [token,value] of Object.entries({ARTIST_COUNT:all.length,FEATURE_COUNT:formatPosition(features.length),HERO:features.map(hero).join(''),TRACKS:all.map(trackLink).join(''),ROOM_COUNT:all.length,ROOM_HINT:all.length>6?`<p class="room-list-hint" id="room-list-hint">Scroll to explore all ${all.length} tracks <span aria-hidden="true">↓</span></p>`:'',EDITOR_PICK:editorPick(),GUIDES:guideCards('h3',true),GUIDE_ARTIST_COUNT:all.length,LATEST:latest()})) home=home.replaceAll(`{{${token}}}`,value);
page('/','indiek — Music from Korea, worth sharing','Hear Korean bands and solo artists through recordings and live performances, with stories about the music and the people who make it.',home,'home-page');
page('/stories/','Stories | indiek','Stories about Korean music: the choices behind a song, the people around it, and where to listen next.',storyView.index);
for(const s of stories){
  const author=authors.find(a=>a.id===s.authorId);
  page(storyPath(s),`${s.title} | indiek`,s.description,storyView.article(s),'story-detail',{author:author.name,authorType:author.type,authorURL:author.url,published:s.published,updated:s.updated});
  promotionItems.push(storyPromotion(s));
}

page('/artists/','Korean artists A–Z | indiek','Browse Korean bands and solo artists, find a song and get to know the people behind it. Artist stories and official recordings, with more to come.',`<main id="main" class="wrap artist-directory" data-artist-directory>
  <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">indiek</a><span aria-hidden="true">/</span><span>Artists</span></nav>
  <header class="guide-heading"><p class="eyebrow">${all.length} ARTISTS AND COUNTING</p><h1>Meet the artists.</h1><p class="guide-lead">Bands, songwriters and voices from Korea. A song from each, a little of their story, and more to come.</p></header>
  <div class="directory-controls" data-js-only hidden><label for="artist-query">Find an artist or song</label><input id="artist-query" type="search" enterkeyhint="search" placeholder="Name or song, in English or Korean" autocomplete="off" aria-controls="artist-grid" spellcheck="false"><div class="filter-bar"><div class="filters" role="group" aria-label="Filter by artist type"><button data-directory-filter="all" aria-pressed="true" aria-controls="artist-grid">All artists</button><button data-directory-filter="bands" aria-pressed="false" aria-controls="artist-grid">Bands</button><button data-directory-filter="solo" aria-pressed="false" aria-controls="artist-grid">Solo artists</button></div><button class="directory-reset" data-directory-reset hidden>Reset filters</button></div></div>
  <div class="directory-summary"><p class="mono" id="artist-result-count" tabindex="-1" role="status" aria-live="polite" aria-atomic="true">${all.length} artists · A–Z</p><a class="underlink" href="/notes/first-listens/">Try a listening guide <span aria-hidden="true">↗</span></a></div>
  <p id="artist-empty" class="directory-empty" hidden>No artists found. Try another name or reset the filters.</p>
  <div class="artist-grid" id="artist-grid">${getArtistDirectory(catalogue).map(artistCard).join('')}</div>
  <div class="directory-consent">${youtubeConsentHTML()}</div>
</main>`);

for(const r of all) {
  const feature=features.find(f=>f.id===r.id && f.kind==='portrait');
  const sources=[{url:r.source,label:r.sourceName,language:r.sourceLanguage},{url:r.artistSource,label:r.artistSourceName,language:r.artistSourceLanguage},...(r.extraSources||[])];
  const main=`<main id="main" class="wrap artist-page"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">indiek</a><span aria-hidden="true">/</span><a href="/artists/">Artists</a></nav>
  <header class="artist-heading"><p class="eyebrow">MEET THE ARTIST / <span lang="ko">${e(r.korean)}</span></p><h1>${e(r.artist)}</h1><p class="artist-lead">${e(r.artistIntro)}</p>${byline(r.editorial)}${shareControl()}</header>
  ${feature?`<figure class="artist-portrait">${imageHTML(media,feature.image,feature.alt,{priority:true,sizes:'(max-width: 760px) 92vw, 960px',style:`object-position:${feature.position}`})}<figcaption>${e(rights.images.find(image=>image.file===feature.image)?.caption || 'Artist photograph.')} ${photoCredit(feature.image) || '<a href="/about/#image-credits">Image credits</a>'}</figcaption></figure>`:''}
  ${r.biography?`<div class="artist-extra"><p>${e(r.biography)}</p></div>`:''}
  <section class="track-page" id="listen" aria-labelledby="track-title"><div class="track-summary">${coverHTML(media,r,{sizes:'(max-width: 760px) 45vw, 300px',className:'detail-cover'})}<p class="eyebrow">${e(r.genre)} / ${r.year}</p><h2 id="track-title">${e(r.track)}${r.koreanTitle?`<span class="track-korean" lang="ko">${e(r.koreanTitle)}</span>`:''}</h2><p class="record-format mono">${videoLabel(r)}</p>${r.releaseYear?`<p class="embed-caption">Single: ${r.year} · ${e(r.release)}: ${r.releaseYear}</p>`:''}${r!==pick?saveButton(r,true):''}<p class="release-link">${out(r.source,'View release on Apple Music','underlink')}</p></div><div class="track-reading"><p class="track-description">${e(r.description)}</p>${r.listeningNote?`<section class="listening-note"><h3>A little background</h3><p>${e(r.listeningNote)}</p></section>`:''}${r.credits?`<p class="pick-credits">${e(r.credits)}</p>`:''}${player(r)}</div></section>
  ${r.moreTracks?`<div class="more-listening">${moreTracks(r)}</div>`:''}
  ${related(r)}
  <section class="page-sources" aria-labelledby="sources-title"><h2 id="sources-title">Sources & further reading</h2><ul>${sources.map(s=>`<li>${sourceLink(s.url,s.label,s.language)}</li>`).join('')}</ul><p>These are independent listening notes, not an interview or an official artist statement. For a correction, email <a href="mailto:${site.email}">${site.email}</a>.</p><p><a href="/about/#image-credits">Image credits</a></p></section><a class="underlink back-to-shelf" href="/artists/">All artists <span aria-hidden="true">↗</span></a></main>`;
  page(artistPath(r),`${r.artist} — ${r.track} | indiek`,`${r.artist}: ${r.track}${r.koreanTitle?` (${r.koreanTitle})`:''}. ${r.note} Listen, meet the artist and explore the release.`,main,'detail-page',r.editorial);
  promotionItems.push({id:r.id,kind:'artist',title:`${r.artist} — ${r.track}`,path:artistPath(r),description:r.description,artistIds:[r.id],image:shareImagePath(artistPath(r)),altText:`indiek listening notes: ${r.artist} — ${r.track}. Typographic card.`});
}
const prose=(eyebrow,title,body)=>`<main id="main" class="wrap prose-page"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${body}<p class="prose-back"><a class="underlink" href="/#records">Back to the music <span aria-hidden="true">↗</span></a></p></main>`;
page('/notes/first-listens/','Listening guides | indiek','Korean music grouped around live performances, guitars and voices, with an introductory guide for new listeners.',`<main id="main" class="wrap guide-hub">
  <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">indiek</a><span aria-hidden="true">/</span><span>Listening guides</span></nav>
  <header class="guide-heading"><p class="eyebrow">${all.length} ARTISTS / ${guides.length} GUIDES</p><h1>Find your way in.</h1><p class="guide-lead">A few ways to browse the music here: live performances, guitar songs or a voice that catches your ear. There’s an introductory guide too, if you’re new to Korean music.</p></header>
  ${shareControl()}${guideCards('h2')}<a class="underlink back-to-shelf" href="/#notes">Back to the journal <span aria-hidden="true">↗</span></a></main>`);

for (const guide of guides) {
  const members = guideMembers(guide);
  const portraits = members.map(r=>features.find(f=>f.id===r.id && f.kind==='portrait')).filter(Boolean);
  const portrait = portraits.find(f=>f.id===guide.cardImageArtistId) || portraits[0];
  page(guidePath(guide),`${guide.title} — Listening guide | indiek`,guide.description,`<main id="main" class="wrap guide-page" data-guide-page="${guide.id}">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">indiek</a><span aria-hidden="true">/</span><a href="/notes/first-listens/">Listening guides</a></nav>
    <header class="guide-heading${portrait?' guide-heading-with-cover':''}"><div><p class="eyebrow">LISTENING GUIDE / ${members.length} ${members.length===1?'TRACK':'TRACKS'}</p><h1>${e(guide.title)}</h1><p class="guide-lead">${e(guide.intro)}</p>${byline(guide.editorial)}${shareControl()}</div>${portrait?`<figure>${imageHTML(media,portrait.image,portrait.alt,{priority:true,sizes:'(max-width: 760px) 100px, 240px',className:'guide-portrait',style:`object-position:${portrait.position}`})}<figcaption><span>In this guide</span><br><a href="${artistPath(portrait)}">${e(find(portrait.id).artist)}</a>${photoCredit(portrait.image)}</figcaption></figure>`:''}</header>
    <div class="guide-essay">${(guide.paragraphs||[]).map(text=>`<p>${e(text)}</p>`).join('')}</div>
    ${youtubeConsentHTML()}
    <ol class="guide-tracks" aria-label="Tracks in this guide">${guide.records.map((r,i)=>guideTrack(r,i,guide)).join('')}</ol>
    ${guideCatalogue(guide)}
    ${guide.sources?`<section class="guide-sources"><h2>Sources & song context</h2><ul>${guide.sources.map(source=>`<li><a href="${e(source.url)}">${e(source.label)}</a></li>`).join('')}</ul><p>The artist pages link to the interviews, release notes and other sources behind these stories.</p></section>`:''}
    <nav class="guide-next" aria-label="Other listening guides"><h2>Keep exploring.</h2><div>${guides.filter(other=>other.id!==guide.id).map(other=>`<a class="underlink" href="${guidePath(other)}">${e(other.title)} <span aria-hidden="true">↗</span></a>`).join('')}</div></nav>
    <a class="underlink back-to-shelf" href="/notes/first-listens/">All listening guides <span aria-hidden="true">↗</span></a></main>`,'',guide.editorial);
  if(guide.status!=='draft')promotionItems.push({id:guide.id,kind:'guide',title:guide.title,path:guidePath(guide),description:guide.description,artistIds:members.map(r=>r.id),image:shareImagePath(guidePath(guide)),altText:`indiek listening guide: ${guide.title}. Typographic card.`});
}

page('/about/','About & contact | indiek','Korean artists and songs I wish more people knew. A personal music selection, with room for new discoveries. Get in touch at gw@lumejs.com.',prose('A NOTE FROM INDIEK','Good music travels.',`<p class="prose-lead">Korean artists and songs I wish more people knew.</p><section><h2>Why I made indiek.</h2><p>I wanted a place to share music I like with people who might not have heard it. There are bands and solo artists here, from indie and folk to pop, hip-hop and R&amp;B.</p><p>I add to the selection as I find more music. A song doesn’t have to be new to belong here. Alongside the recordings and live clips, there’s a little about the artists and the stories behind their songs.</p><p>indiek is not affiliated with the featured artists, their labels, YouTube or Apple Music.</p></section><section id="editorial"><h2>How the stories are made.</h2><p>Features published under the indiek name use AI-assisted research, drafting and automated factual and editorial checks. We link the original reporting and release records used in each story. These checks can miss things; corrections are welcome.</p><p>We distinguish reported information from interpretation. We do not invent interviews, personal listening memories or visits to a show. An existing interview stays credited to its original publication. A date changes when a story is actually updated, not to make an older article look new.</p><p>Guest contributions carry the contributor’s own name and a description of their involvement. Sources and image credits are part of the editing process; a public photograph is not automatically licensed for reuse.</p></section><section id="contribute"><h2>Have a story in mind?</h2><p>We welcome ideas about music from Korea: a song with an unexpected history, a small scene worth understanding, or a question you have spent time exploring. Send a short pitch, the angle and any relevant writing samples to <a href="mailto:${site.email}?subject=Story%20pitch">${site.email}</a>.</p><p>Please tell us what you have researched or experienced yourself and disclose any involvement with the artists. We will discuss editing, credits, rights and any terms before accepting a contribution. Sending a pitch does not transfer your rights or guarantee publication.</p></section><section id="contact"><h2>Get in touch.</h2><p>For questions, factual corrections, credit updates, or requests concerning an image or other content, email <a href="mailto:${site.email}">${site.email}</a>.</p><p>Include the page address and the material you are referring to. For an image request, please describe your connection to the work. Please avoid sending sensitive personal documents in an initial message.</p></section><section id="image-credits"><h2>Image credits.</h2><p>Artist photographs and release artwork belong to their respective rights holders. The links below identify the sources of images used in the journal. Source credit does not itself grant permission to reuse an image.</p><ul class="credit-list">${rights.images.map(image=>`<li id="${creditId(image.file)}"><strong>${e(image.label)}</strong><br>${sourceLink(image.source,image.credit,image.language)}${image.license?` · ${image.licenseUrl?out(image.licenseUrl,image.license):e(image.license)}<br>${e(image.changes)}`:""}</li>`).join('')}</ul><p>The indiek sharing graphics are original typography. Barlow Condensed, DM Sans and IBM Plex Mono are used under the SIL Open Font License.</p></section>`));

page('/privacy-and-terms/','Privacy & terms | indiek','How indiek uses browser storage, optional visit statistics and embedded YouTube players.',prose('HOW THIS SITE WORKS','Privacy & terms.',`<p class="policy-date mono">LAST UPDATED / 19 OCTOBER 2026</p><p class="prose-lead">indiek is an independent music journal. Questions about these practices can be sent to <a href="mailto:${site.email}">${site.email}</a>.</p>
<section><h2>Your saved tracks.</h2><p>When you save a track, its identifier is kept in this browser’s local storage. The list stays on this device and browser; indiek does not send it to an account or a server. It remains until you remove tracks or clear this site’s browser data.</p><p>To delete an entry, open Saved and choose Remove beside the track. Remove all entries to empty the list, or use your browser’s site-data controls to clear it entirely. If browser storage is unavailable, saving works only for the current page visit.</p><p>Search runs against the journal’s music catalogue in your browser. Search terms are not sent to a search service. The site does not include advertising trackers, account registration or a comment form.</p></section>
<section id="analytics"><h2>Optional visit statistics.</h2><p>If you allow analytics, indiek uses our Matomo installation at matomo.lumejs.com to understand visits, return visits and how people find and listen to music here. No Matomo script or tracking request is sent before you allow it. Declining does not affect the rest of the site.</p><p>Matomo receives the page address and title, visit time, referring domain, and basic browser and request information. IP addresses are masked before being stored in analytics records and used for approximate location. Page query strings, URL fragments and referring-page paths are excluded. A link marked from=threads or from=instagram records only that platform name and the landing page. We also record when an embedded song actually starts, a song is added to Saved, or a page is successfully shared or copied. These events contain the song identifier or page path, not your full saved list. We do not collect search terms or account identifiers, and we do not use session recordings. After consent, first-party Matomo cookies distinguish returning browsers for up to 35 days; a session cookie lasts 30 minutes. Different devices and browsers can be counted separately.</p><p>Your analytics choice is stored in this browser for up to 180 days. Use Analytics settings in the footer to change it or withdraw consent. Withdrawal stops further tracking and removes indiek’s analytics cookies; it does not erase already collected records. Earlier permission for cookieless statistics does not enable this version: we ask again, while respecting an earlier refusal. We respect Do Not Track and Global Privacy Control when those browser preferences are enabled. Analytics data is kept on our server for site statistics and is not shared with advertising services. For questions or deletion requests, contact <a href="mailto:${site.email}">${site.email}</a>.</p><button class="underlink" data-analytics-settings hidden>Change analytics settings</button></section>
<section><h2>YouTube players.</h2><p>This site uses YouTube API Services through embedded video players. The player and YouTube’s IFrame API script are not loaded until you choose “Agree &amp; play” or “Agree &amp; play all”. That action accepts this privacy notice and these terms for the player, including the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>.</p><p>Loading a player connects your browser to YouTube. YouTube receives basic information such as your IP address and browser or device information to deliver and secure its player. Playing the video can involve additional information collection, cookies or similar technologies, and advertisements. Details are set out in <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google’s Privacy Policy</a>.</p><p>Players use YouTube’s privacy-enhanced domain. This reduces certain personalization uses; it does not make the connection anonymous or prevent all data collection. Either “Agree &amp; play” button connects and requests playback in one action. This choice is remembered while you browse in the same page session, so subsequent buttons say “Play”; reloading or leaving the site resets it. Nothing loads again after closing the player until you choose a track. You can play directly from Saved, from an artist page, or with Previous and Next. With Auto-next on, a saved track continues to the next playable track in the displayed order when it ends; playback stops at the end of the list. Play all restarts the first saved track from the beginning and turns Auto-next on. You can turn Auto-next off at any time. If your browser blocks automatic playback, press play in the video to continue.</p><p>On mobile, playback starts in a bottom dock and the page scrolls above it. In a short landscape view, the video sits beside the page. Saved and search have their own scrolling lists, separate from the video. Saved keeps your place in the list, with Play all, Previous, Next and Auto-next always within reach. Choosing a song closes the list. For a larger view, use the video’s own fullscreen control. On desktop, the listening window shows your saved tracks alongside the video; Minimize and Expand keep the same video and playback position. The player stays connected while you follow internal links, including browser Back and Forward, in the same tab. Loading another song replaces the current video. Choose Disconnect YouTube or the player’s close button to stop playback and remove the connection, or reload or leave the site. This does not erase information already received by YouTube or clear that service’s cookies. You can also follow the direct YouTube link instead of loading an embedded player.</p><p>indiek does not request your Google account details or access private YouTube account data. Video availability can change and may differ by location.</p></section>
<section><h2>External links and service requests.</h2><p>Following a link to YouTube, Apple Music or a source publication takes you to a separate service governed by its own terms and privacy policy. indiek does not receive your listening history from those services.</p><p>Delivering a web page requires the server to receive request information such as an IP address, browser information and the requested address. Routine access logging is disabled in this site’s Nginx configuration. Error logs may contain request information needed for troubleshooting and are rotated by the hosting configuration. The journal does not combine this information with your saved tracks or search terms.</p></section>
<section><h2>Messages and corrections.</h2><p>If you email <a href="mailto:${site.email}">${site.email}</a>, your address and message are used to respond and handle your request. Messages may be retained as needed to resolve the request and keep a record of the correction or correspondence. You can ask about or request deletion of that correspondence using the same address; any limits on deletion will be explained in the reply.</p></section>
<section><h2>Using this journal.</h2><p>These are independent listening notes, not official artist statements. Music, videos, artist photographs and release artwork remain the property of their respective rights holders. Links and credits do not grant a licence to copy or redistribute that material.</p><p>indiek does not host downloadable music or provide a licence to download it. Use the official players and services according to their terms. For corrections, credit changes or content removal requests, contact <a href="mailto:${site.email}">${site.email}</a>.</p><p>This notice will be updated if the site’s features or data practices change.</p></section>`));

writeFileSync(path.join(root,'dist/catalogue.js'),`export default ${JSON.stringify({...catalogue,listeningGuides:catalogue.listeningGuides.filter(g=>g.status!=='draft'),stories:storyIndex(stories),media})};\n`);
copyFileSync(path.join(root,'site/stories.mjs'),path.join(root,'dist/stories.mjs'));
copyFileSync(path.join(root,'site/shared.mjs'),path.join(root,'dist/shared.mjs'));
copyFileSync(path.join(root,'site/app.js'),path.join(root,'dist/app.js'));
copyFileSync(path.join(root,'site/analytics.mjs'),path.join(root,'dist/analytics.mjs'));
copyFileSync(path.join(root,'site/mobile.mjs'),path.join(root,'dist/mobile.mjs'));
copyFileSync(path.join(root,'site/navigation.mjs'),path.join(root,'dist/navigation.mjs'));
copyFileSync(path.join(root,'site/directory.mjs'),path.join(root,'dist/directory.mjs'));
copyFileSync(path.join(root,'site/player.mjs'),path.join(root,'dist/player.mjs'));
copyFileSync(path.join(root,'site/styles.css'),path.join(root,'dist/styles.css'));
writeFileSync(path.join(root,'dist/robots.txt'),`User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
writeFileSync(path.join(root,'dist/sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(url=>`<url><loc>${url}</loc></url>`).join('')}</urlset>\n`);
writeFileSync(path.join(root,'dist/feed.xml'),feedXML(site,entries));
writeFileSync(path.join(root,'dist/promotion-catalogue.json'),JSON.stringify({version:1,origin:site.url,items:promotionItems},null,2)+'\n');
const images = spawnSync('python3',[path.join(root,'scripts/social-images.py')],{input:JSON.stringify(socialImages),encoding:'utf8'});
if(images.status!==0)throw new Error(images.stderr || 'Sharing image generation failed');
console.log(images.stdout.trim());
console.log(`Built ${pages.length} static pages for ${site.url}. No deployment performed.`);
