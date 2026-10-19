import {readFileSync, writeFileSync, mkdirSync, copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {escapeHTML as e, artistPath, imageHTML, coverHTML, videoLabel, externalLink as out, saveButton, getFeaturedArtists, getListeningGuides, guidePath, formatPosition, youtubeConsentHTML} from '../site/shared.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFileSync(path.join(root, file), 'utf8');
const catalogue = JSON.parse(read('content/catalogue.json'));
const media = JSON.parse(read('content/media.json'));
const {site, records, editorPick: pick} = catalogue;
const features = getFeaturedArtists(catalogue);
const guides = getListeningGuides(catalogue);
const all = [...records, pick];
const version = '20261019-mobile-lists';
const pages = [];
const find = id => all.find(r => r.id === id);
const sourceLink = (url, label, language = '') => out(url, `${label}${language ? ` (${language})` : ''}`);

function header() {
  return `<a class="skip-link" href="#main">Skip to content</a><header class="topbar wrap">
    <a href="/" class="small-logo" aria-label="indiek home">ik<span class="logo-dot">.</span></a>
    <nav aria-label="Main navigation"><a href="/#discover">Discover</a><a href="/#records">The listening shelf</a><a href="/#notes">Listening guides</a></nav>
    <div class="header-actions" data-js-only hidden><button class="text-button saved-link" data-library>Saved <span class="saved-count">0</span></button><button class="search-button" data-search aria-label="Find an artist or song"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></button></div>
  </header>`;
}
function footer() {
  return `<footer class="footer wrap"><a class="small-logo" href="/" aria-label="indiek home">indiek.</a><span class="mono">KOREAN MUSIC. OPEN EARS.</span><div><a href="/about/">About & contact</a><a href="/privacy-and-terms/">Privacy & terms</a><a href="mailto:${site.email}">Get in touch</a><button class="analytics-settings" data-analytics-settings hidden>Analytics settings</button><span class="mono">© 2026 INDIEK</span></div></footer>`;
}
function overlays() {
  return `<section class="analytics-notice" id="analytics-notice" aria-labelledby="analytics-title" hidden><div><h2 id="analytics-title">Help improve indiek?</h2><p>Allow optional visit statistics, without tracking cookies. <a href="/privacy-and-terms/#analytics">Privacy details</a></p><p id="analytics-status" class="analytics-status" role="status"></p></div><div class="analytics-actions"><button data-analytics-decline>No thanks</button><button data-analytics-allow>Allow analytics</button></div></section>
  <dialog id="content-dialog" aria-labelledby="dialog-title"><div class="dialog-top"><h2 id="dialog-title">Find music</h2><button class="close-button" aria-label="Close dialog">Close <span aria-hidden="true">×</span></button></div><div id="dialog-content"></div></dialog><div class="toast" id="toast" role="status" aria-live="polite"></div>
  <div id="player-backdrop" class="player-backdrop" aria-hidden="true" hidden></div>
  <section id="persistent-player" class="persistent-player" aria-label="YouTube listening window" hidden>
    <span class="sr-only" tabindex="0" data-player-focus="start" hidden></span>
    <div class="persistent-player-heading"><div><p class="mono">NOW LISTENING</p><a data-current-track href="/#records"></a></div><button class="player-saved-toggle" data-library data-mobile-queue aria-label="Open saved tracks" hidden>Saved <span class="saved-count">0</span></button><button class="player-size-toggle" data-resize-player aria-label="Minimize and keep listening">Minimize</button><button data-unload-player aria-label="Stop and close YouTube player" title="Stop and close">×</button></div>
    <div class="persistent-player-body"><div class="persistent-player-stage" data-player-stage></div>
      <aside class="player-playlist" data-player-playlist aria-labelledby="playlist-title" hidden><div class="playlist-heading"><h2 id="playlist-title">Your saved tracks</h2><span class="mono" data-playlist-count></span></div><ol data-playlist-rows></ol><div class="playlist-footer"><p>Plays in the order shown.<br>YouTube-only links are skipped.</p><button data-library>Manage saved tracks ↗</button></div></aside>
    </div><div class="player-transport"><div class="queue-controls" data-queue-controls hidden><button data-previous-track aria-label="Previous saved track" disabled>← Previous</button><button data-next-track aria-label="Next saved track" disabled>Next →</button><button data-auto-next aria-pressed="true">Auto-next: on</button></div><div class="playback-message"><p data-playback-status role="status" aria-live="polite"></p><a data-player-youtube target="_blank" rel="noopener noreferrer" hidden>Open on YouTube ↗</a></div></div><span class="sr-only" tabindex="0" data-player-focus="end" hidden></span>
  </section>`;
}
function page(url, title, description, main, kind = '') {
  const canonical = site.url + url;
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${site.googleSiteVerification ? `<meta name="google-site-verification" content="${e(site.googleSiteVerification)}">` : ''}
<title>${e(title)}</title><meta name="description" content="${e(description)}"><meta name="theme-color" content="#f5f3ed">
<link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:site_name" content="indiek">
<meta property="og:title" content="${e(title)}"><meta property="og:description" content="${e(description)}"><meta property="og:url" content="${canonical}">
<meta property="og:image" content="${site.url}/assets/indiek-share.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="indiek — Good music travels. Music from Korea, worth sharing.">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${e(title)}"><meta name="twitter:description" content="${e(description)}"><meta name="twitter:image" content="${site.url}/assets/indiek-share.png"><meta name="twitter:image:alt" content="indiek — Good music travels.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/fonts.css"><link rel="stylesheet" href="/styles.css?v=${version}"><script type="module" src="/app.js?v=${version}"></script>
</head><body${kind ? ` class="${kind}"` : ''}><div id="page-content">${header()}${main}${footer()}</div>${overlays()}</body></html>\n`;
  const file = path.join(root, 'dist', url, 'index.html');
  mkdirSync(path.dirname(file), {recursive:true});
  writeFileSync(file, html.replace(/[\t ]+$/gm, ''));
  pages.push(canonical);
}
function card(r) {
  return `<article class="record-card" data-category="${r.category}"><div class="record-cover"><a class="cover-button" href="${artistPath(r)}#listen" aria-label="Listen to ${e(r.track)} by ${e(r.artist)}">${coverHTML(media,r)}<span class="cover-listen">OPEN TRACK <span aria-hidden="true">↗</span></span></a></div><div class="record-meta mono"><span>${e(r.genre)} · ${r.year}</span>${saveButton(r)}</div><h3><a href="${artistPath(r)}#listen">${e(r.track)}</a></h3><p class="record-artist">${e(r.artist)}</p>${r.videoType ? `<p class="record-format mono">${videoLabel(r)}</p>` : ''}<p class="record-note">${e(r.note)}</p><p class="record-intro">${e(r.artistIntro)}</p><a class="underlink record-profile-link" href="${artistPath(r)}">Meet the artist <span aria-hidden="true">↗</span></a></article>`;
}
function hero(feature, i) {
  const r = find(feature.id);
  return `<div class="hero-slide${i===0?' is-active':''}" id="hero-${r.id}"${i ? ' hidden aria-hidden="true" inert' : ''} role="group" aria-roledescription="slide" aria-label="${e(r.artist)}, ${i+1} of ${features.length}">
  <a class="hero-image hero-image-${r.id} hero-image-${feature.kind}" href="${artistPath(r)}" aria-label="Meet ${e(r.artist)}">${imageHTML(media,feature.image,feature.alt,{priority:i===0,deferred:i!==0,sizes:feature.kind==='artwork'?'(max-width: 760px) 48vw, 32vw':'(max-width: 760px) calc(100vw - 36px), 62vw',style:`object-position:${feature.position}`})}<span class="location-label mono">${feature.kind==='artwork'?'RELEASE ARTWORK':`${e(r.artist)} / <span lang="ko">${e(r.korean)}</span>`}</span><span class="artist-stamp" aria-hidden="true">${e(r.artist)}</span></a>
  <div class="story-caption"><div><p class="eyebrow">MEET THE ARTIST <span lang="ko">${e(r.korean)}</span></p><h2><a href="${artistPath(r)}">${e(feature.title)}</a></h2></div><a class="round-arrow" href="${artistPath(r)}" aria-label="Read about ${e(r.artist)}">↗</a></div><p class="feature-deck">${feature.deck}</p></div>`;
}
function trackLink(r,i) {
  return `<li><a class="track" data-room-track="${r.id}" href="${artistPath(r)}#listen" aria-label="Listen to ${e(r.track)} by ${e(r.artist)}"><span class="track-number" aria-hidden="true">${formatPosition(i+1)}</span>${coverHTML(media,r,{sizes:'55px'})}<span class="track-info"><strong>${e(r.track)}</strong><span>${e(r.artist)}</span></span>${r.duration?`<span class="track-time">${r.duration}</span>`:''}<span class="track-play" aria-hidden="true">▷</span></a></li>`;
}
function guideCards(heading = 'h3') {
  return `<div class="guide-grid">${guides.map((guide,i)=>{
    const first = guide.records[0];
    const preview = guide.records.slice(0,3).map(r=>e(r.artist)).join(' · ');
    const more = guide.records.length - 3;
    return `<article class="guide-card" data-guide="${guide.id}" data-track-count="${guide.records.length}"><a class="guide-card-link" href="${guidePath(guide)}" aria-label="Explore the guide: ${e(guide.title)}">
      <div class="guide-card-top mono"><span>GUIDE ${formatPosition(i+1)}</span><span>${guide.records.length} ${guide.records.length===1?'TRACK':'TRACKS'}</span></div>
      <div class="guide-artwork">${coverHTML(media,first,{sizes:'(max-width: 760px) 65vw, 24vw'})}</div>
      <p class="guide-featured">START WITH ${e(first.artist)} / ${e(first.track)}</p>
      <${heading}>${e(guide.title)}</${heading}><p class="guide-description">${e(guide.description)}</p>
      <p class="guide-preview">${preview}${more>0?` <span>+ ${more} more</span>`:''}</p>
      <span class="guide-cta">Explore the guide <span aria-hidden="true">↗</span></span>
    </a></article>`;
  }).join('')}</div>`;
}
function guideTrack(r,i) {
  return `<li><a class="guide-track" href="${artistPath(r)}#listen" data-guide-track="${r.id}">
    <span class="guide-track-number mono" aria-hidden="true">${formatPosition(i+1)}</span>${coverHTML(media,r,{sizes:'(max-width: 760px) 76px, 100px'})}
    <div class="guide-track-copy"><p class="eyebrow">${e(r.artist)} / <span lang="ko">${e(r.korean)}</span></p><h2>${e(r.track)}</h2><p class="guide-track-note">${e(r.note)}</p></div>
    <span class="guide-track-action"><span class="mono">${videoLabel(r)}</span><span>Listen & read <span aria-hidden="true">↗</span></span></span>
  </a></li>`;
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
  return `<aside class="artist-listens" aria-labelledby="more-listens-title"><p class="eyebrow">THREE MORE SONGS</p><h3 id="more-listens-title">Keep listening.</h3><ol class="artist-track-links">${r.moreTracks.map((track,i)=>`<li><a href="${track.url}" target="_blank" rel="noopener noreferrer"><span class="mono">0${i+1} / ${track.year}</span><span><strong>${e(track.title)}</strong><small>${e(track.note)}</small></span><span aria-hidden="true">↗</span></a></li>`).join('')}</ol><p class="artist-listens-note mono">LISTEN ON YOUTUBE ↗</p></aside>`;
}
function editorPick() {
  return `<section class="editor-pick wrap" id="editors-pick" aria-labelledby="editors-pick-title"><div class="pick-copy"><p class="eyebrow">EDITOR’S PICK / R&amp;B</p><h2 id="editors-pick-title"><a href="${artistPath(pick)}">${pick.artist}</a><span>${pick.track} <span lang="ko">(${pick.koreanTitle})</span></span></h2><p class="pick-date mono">SINGLE / ${pick.releaseDate.toUpperCase()}</p><p class="pick-description">${e(pick.description)}</p><p class="pick-credits">${e(pick.credits)}<br>${out(pick.source,'View release on Apple Music')}</p></div><div class="pick-video">${player(pick,true)}</div><div class="artist-profile"><article class="artist-bio" aria-labelledby="yoon-mirae-profile-title"><p class="eyebrow">BEHIND THE VOICE / <span lang="ko">윤미래</span></p><h3 id="yoon-mirae-profile-title">Meet Yoon Mirae.</h3><p>${e(pick.artistIntro)}</p><p>${e(pick.biography)}</p><p class="artist-sources">${sourceLink(pick.artistSource,'Artist biography','Korean')} · ${sourceLink(pick.extraSources[0].url,'Korean Music Awards','Korean')}</p><a class="underlink" href="${artistPath(pick)}">More about Yoon Mirae <span aria-hidden="true">↗</span></a></article>${moreTracks(pick)}</div></section>`;
}
let home = read('site/templates/home.html');
for(const [token,value] of Object.entries({COUNT:records.length,FEATURE_COUNT:formatPosition(features.length),HERO:features.map(hero).join(''),TRACKS:all.map(trackLink).join(''),ROOM_COUNT:all.length,ROOM_HINT:all.length>6?`<p class="room-list-hint" id="room-list-hint">Scroll to explore all ${all.length} tracks <span aria-hidden="true">↓</span></p>`:'',EDITOR_PICK:editorPick(),RECORDS:records.map(card).join(''),GUIDES:guideCards(),GUIDE_ARTIST_COUNT:all.length})) home=home.replaceAll(`{{${token}}}`,value);
page('/','indiek — Music from Korea, worth sharing','A personal, non-commercial listening journal sharing Korean artists and songs with listeners around the world. Official videos, live performances and artist stories.',home,'home-page');

for(const r of all) {
  const feature=features.find(f=>f.id===r.id && f.kind==='portrait');
  const sources=[{url:r.source,label:r.sourceName,language:r.sourceLanguage},{url:r.artistSource,label:r.artistSourceName,language:r.artistSourceLanguage},...(r.extraSources||[])];
  const main=`<main id="main" class="wrap artist-page"><nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">indiek</a><span aria-hidden="true">/</span><a href="/#records">The listening shelf</a></nav>
  <header class="artist-heading"><p class="eyebrow">MEET THE ARTIST / <span lang="ko">${e(r.korean)}</span></p><h1>${e(r.artist)}</h1><p class="artist-lead">${e(r.artistIntro)}</p></header>
  ${feature?`<figure class="artist-portrait">${imageHTML(media,feature.image,feature.alt,{priority:true,sizes:'(max-width: 760px) 92vw, 960px',style:`object-position:${feature.position}`})}<figcaption>Artist photograph. <a href="/about/#image-credits">Image credits</a></figcaption></figure>`:''}
  ${r.biography?`<div class="artist-extra"><p>${e(r.biography)}</p></div>`:''}
  <section class="track-page" id="listen" aria-labelledby="track-title"><div class="track-summary">${coverHTML(media,r,{sizes:'(max-width: 760px) 45vw, 300px',className:'detail-cover'})}<p class="eyebrow">${e(r.genre)} / ${r.year}</p><h2 id="track-title">${e(r.track)}${r.koreanTitle?`<span class="track-korean" lang="ko">${e(r.koreanTitle)}</span>`:''}</h2><p class="record-format mono">${videoLabel(r)}</p>${r.releaseYear?`<p class="embed-caption">Single: ${r.year} · ${e(r.release)}: ${r.releaseYear}</p>`:''}${r!==pick?saveButton(r,true):''}<p class="release-link">${out(r.source,'View release on Apple Music','underlink')}</p></div><div class="track-reading"><p class="track-description">${e(r.description)}</p>${r.listeningNote?`<section class="listening-note"><h3>Listening note</h3><p>${e(r.listeningNote)}</p></section>`:''}${r.credits?`<p class="pick-credits">${e(r.credits)}</p>`:''}${player(r)}</div></section>
  ${r.moreTracks?`<div class="more-listening">${moreTracks(r)}</div>`:''}
  <section class="page-sources" aria-labelledby="sources-title"><h2 id="sources-title">Sources & further reading</h2><ul>${sources.map(s=>`<li>${sourceLink(s.url,s.label,s.language)}</li>`).join('')}</ul><p>These notes are an independent fan’s introduction, not an interview or an official artist statement. For a correction, email <a href="mailto:${site.email}">${site.email}</a>.</p><p><a href="/about/#image-credits">Image credits</a></p></section><a class="underlink back-to-shelf" href="/#records">Back to the listening shelf <span aria-hidden="true">↗</span></a></main>`;
  page(artistPath(r),`${r.artist} — ${r.track} | indiek`,`${r.artist}: ${r.track}${r.koreanTitle?` (${r.koreanTitle})`:''}. ${r.note} Listen, meet the artist and explore the release.`,main,'detail-page');
}
const prose=(eyebrow,title,body)=>`<main id="main" class="wrap prose-page"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${body}<p class="prose-back"><a class="underlink" href="/#records">Back to the music <span aria-hidden="true">↗</span></a></p></main>`;
page('/notes/first-listens/','Listening guides | indiek','Find Korean artists through official live performances, guitars and distinctive voices. Choose a listening guide and follow the songs.',`<main id="main" class="wrap guide-hub">
  <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">indiek</a><span aria-hidden="true">/</span><span>Listening guides</span></nav>
  <header class="guide-heading"><p class="eyebrow">${all.length} ARTISTS / ${guides.length} GUIDES</p><h1>Find your way in.</h1><p class="guide-lead">Start with a live performance, a guitar, or a voice. Each guide brings together songs from across the journal, with a place to begin and room to keep exploring.</p></header>
  ${guideCards('h2')}<a class="underlink back-to-shelf" href="/#notes">Back to the journal <span aria-hidden="true">↗</span></a></main>`);

for (const guide of guides) {
  const first = guide.records[0];
  page(guidePath(guide),`${guide.title} — Listening guide | indiek`,guide.description,`<main id="main" class="wrap guide-page" data-guide-page="${guide.id}">
    <nav class="breadcrumb" aria-label="Breadcrumb"><a href="/">indiek</a><span aria-hidden="true">/</span><a href="/notes/first-listens/">Listening guides</a></nav>
    <header class="guide-heading guide-heading-with-cover"><div><p class="eyebrow">LISTENING GUIDE / ${guide.records.length} ${guide.records.length===1?'TRACK':'TRACKS'}</p><h1>${e(guide.title)}</h1><p class="guide-lead">${e(guide.intro)}</p></div><figure>${coverHTML(media,first,{priority:true,sizes:'(max-width: 760px) 120px, 240px'})}<figcaption>Start with ${e(first.artist)}<br><span>${e(first.track)}</span></figcaption></figure></header>
    <ol class="guide-tracks" aria-label="Tracks in this guide">${guide.records.map(guideTrack).join('')}</ol>
    <nav class="guide-next" aria-label="Other listening guides"><h2>Keep exploring.</h2><div>${guides.filter(other=>other.id!==guide.id).map(other=>`<a class="underlink" href="${guidePath(other)}">${e(other.title)} <span aria-hidden="true">↗</span></a>`).join('')}</div></nav>
    <a class="underlink back-to-shelf" href="/notes/first-listens/">All listening guides <span aria-hidden="true">↗</span></a></main>`);
}

const rights=JSON.parse(read('content/image-rights.json'));
page('/about/','About & contact | indiek','An independent, non-commercial fan journal sharing Korean music. Contact gw@lumejs.com for questions, corrections or image removal requests.',prose('A NOTE FROM INDIEK','Good music travels.',`<p class="prose-lead">An independent, non-commercial fan journal sharing Korean music with listeners around the world.</p><section><h2>A personal selection.</h2><p>I made indiek to share Korean artists and songs I wish more people knew. The name is indiek, but the selection reaches across genres, labels and levels of fame.</p><p>This is a listening journal, not a ranking or a news feed. A song can belong here long after its release. Official music videos, live performances and release links give you a way to listen and keep exploring.</p><p>indiek is not affiliated with the featured artists, their labels, YouTube or Apple Music. There are no sales, affiliate links, subscriptions or paid placements on this site.</p></section><section id="contact"><h2>Get in touch.</h2><p>For questions, factual corrections, credit updates, or requests concerning an image or other content, email <a href="mailto:${site.email}">${site.email}</a>.</p><p>Include the page address and the material you are referring to. For an image request, please describe your connection to the work. Please avoid sending sensitive personal documents in an initial message.</p></section><section id="image-credits"><h2>Image credits.</h2><p>Artist photographs and release artwork belong to their respective rights holders. The links below identify the sources used for this edition. Source credit does not itself grant permission to reuse an image.</p><ul class="credit-list">${rights.images.map(image=>`<li><strong>${e(image.label)}</strong><br>${sourceLink(image.source,image.credit,image.language)}</li>`).join('')}</ul><p>The indiek sharing graphic is original typography. Barlow Condensed, DM Sans and IBM Plex Mono are used under the SIL Open Font License.</p></section>`));

page('/privacy-and-terms/','Privacy & terms | indiek','How indiek uses browser storage, optional visit statistics and embedded YouTube players.',prose('HOW THIS SITE WORKS','Privacy & terms.',`<p class="policy-date mono">LAST UPDATED / 19 OCTOBER 2026</p><p class="prose-lead">indiek is a personal, non-commercial music journal. Questions about these practices can be sent to <a href="mailto:${site.email}">${site.email}</a>.</p>
<section><h2>Your saved tracks.</h2><p>When you save a track, its identifier is kept in this browser’s local storage. The list stays on this device and browser; indiek does not send it to an account or a server. It remains until you remove tracks or clear this site’s browser data.</p><p>To delete an entry, open Saved and choose Remove beside the track. Remove all entries to empty the list, or use your browser’s site-data controls to clear it entirely. If browser storage is unavailable, saving works only for the current page visit.</p><p>Search runs against this edition’s catalogue in your browser. Search terms are not sent to a search service. The site does not include advertising trackers, account registration or a comment form.</p></section>
<section id="analytics"><h2>Optional visit statistics.</h2><p>If you allow analytics, indiek uses our Matomo installation at matomo.lumejs.com to understand which pages people visit and which sites refer them. No Matomo script or tracking request is sent before you allow it. Declining does not affect the rest of the site.</p><p>Matomo receives the page address and title, visit time, referring domain, and basic browser and request information. IP addresses are masked before being stored in analytics records and used for approximate location. Page query strings, URL fragments and referring-page paths are excluded. We do not collect search terms, your saved list or user account identifiers, and we do not use session recordings or tracking cookies.</p><p>Your analytics choice is stored in this browser for up to 180 days. Use Analytics settings in the footer to change it or withdraw consent for future visits. We respect Do Not Track and Global Privacy Control when those browser preferences are enabled. Analytics data is kept on our server for site statistics and is not shared with advertising services. For questions or deletion requests, contact <a href="mailto:${site.email}">${site.email}</a>.</p><button class="underlink" data-analytics-settings hidden>Change analytics settings</button></section>
<section><h2>YouTube players.</h2><p>This site uses YouTube API Services through embedded video players. The player and YouTube’s IFrame API script are not loaded until you choose “Agree &amp; play”. That action accepts this privacy notice and these terms for the player, including the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>.</p><p>Loading a player connects your browser to YouTube. YouTube receives basic information such as your IP address and browser or device information to deliver and secure its player. Playing the video can involve additional information collection, cookies or similar technologies, and advertisements. Details are set out in <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google’s Privacy Policy</a>.</p><p>Players use YouTube’s privacy-enhanced domain. This reduces certain personalization uses; it does not make the connection anonymous or prevent all data collection. Choosing “Agree &amp; play” connects and requests playback in one action. This choice is remembered while you browse in the same page session, so subsequent buttons say “Play”; reloading or leaving the site resets it. Nothing loads again after closing the player until you choose a track. You can play directly from Saved, from an artist page, or with Previous and Next. With Auto-next on, a saved track continues to the next playable track in the displayed order when it ends; playback stops at the end of the list. YouTube-only links are skipped. You can turn Auto-next off at any time. If your browser blocks automatic playback, press play in the video to continue.</p><p>On mobile, playback starts in a bottom dock and the page scrolls above it. In a short landscape view, the video sits beside the page. Saved and search have their own scrolling lists, separate from the video. Saved keeps your place in the list, with Previous, Next and Auto-next always within reach. Choosing a song closes the list. For a larger view, use the video’s own fullscreen control. On desktop, the listening window shows your saved tracks alongside the video; Minimize and Expand keep the same video and playback position. The player stays connected while you follow internal links, including browser Back and Forward, in the same tab. Loading another song replaces the current video. Choose Disconnect YouTube or the player’s close button to stop playback and remove the connection, or reload or leave the site. This does not erase information already received by YouTube or clear that service’s cookies. You can also follow the direct YouTube link instead of loading an embedded player.</p><p>indiek does not request your Google account details or access private YouTube account data. Video availability can change and may differ by location.</p></section>
<section><h2>External links and service requests.</h2><p>Following a link to YouTube, Apple Music or a source publication takes you to a separate service governed by its own terms and privacy policy. indiek does not receive your listening history from those services.</p><p>Delivering a web page requires the server to receive request information such as an IP address, browser information and the requested address. Routine access logging is disabled in this site’s Nginx configuration. Error logs may contain request information needed for troubleshooting and are rotated by the hosting configuration. The journal does not combine this information with your saved tracks or search terms.</p></section>
<section><h2>Messages and corrections.</h2><p>If you email <a href="mailto:${site.email}">${site.email}</a>, your address and message are used to respond and handle your request. Messages may be retained as needed to resolve the request and keep a record of the correction or correspondence. You can ask about or request deletion of that correspondence using the same address; any limits on deletion will be explained in the reply.</p></section>
<section><h2>Using this journal.</h2><p>These are independent listening notes, not official artist statements. Music, videos, artist photographs and release artwork remain the property of their respective rights holders. Links and credits do not grant a licence to copy or redistribute that material.</p><p>indiek does not host downloadable music or provide a licence to download it. Use the official players and services according to their terms. For corrections, credit changes or content removal requests, contact <a href="mailto:${site.email}">${site.email}</a>.</p><p>This notice will be updated if the site’s features or data practices change.</p></section>`));

writeFileSync(path.join(root,'dist/catalogue.js'),`export default ${JSON.stringify({...catalogue,media})};\n`);
copyFileSync(path.join(root,'site/shared.mjs'),path.join(root,'dist/shared.mjs'));
copyFileSync(path.join(root,'site/app.js'),path.join(root,'dist/app.js'));
copyFileSync(path.join(root,'site/analytics.mjs'),path.join(root,'dist/analytics.mjs'));
copyFileSync(path.join(root,'site/mobile.mjs'),path.join(root,'dist/mobile.mjs'));
copyFileSync(path.join(root,'site/navigation.mjs'),path.join(root,'dist/navigation.mjs'));
copyFileSync(path.join(root,'site/player.mjs'),path.join(root,'dist/player.mjs'));
copyFileSync(path.join(root,'site/styles.css'),path.join(root,'dist/styles.css'));
writeFileSync(path.join(root,'dist/robots.txt'),`User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
writeFileSync(path.join(root,'dist/sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(url=>`<url><loc>${url}</loc></url>`).join('')}</urlset>\n`);
console.log(`Built ${pages.length} static pages for ${site.url}. No deployment performed.`);
