import catalogue from './catalogue.js';
import {initAnalytics} from './analytics.mjs';
import {initNavigation, createPageScroll} from './navigation.mjs';
import {createPlayer} from './player.mjs';
import {mobilePlayerQuery, initMobileViewport} from './mobile.mjs';
import {escapeHTML as e, artistPath, coverHTML, readSaved, searchCatalogue, getFeaturedArtists, formatPosition, youtubeConsentHTML, getListeningGuides, guidePath} from './shared.mjs';

const {records, editorPick: pick, media} = catalogue;
const features = getFeaturedArtists(catalogue);
const all = [...records,pick];
const findRecord = id => all.find(r => r.id === id);
const storageKey = 'indiek-saved-v1';
let saved;
try { saved = readSaved(localStorage.getItem(storageKey),records); } catch { saved = new Set(); }
const dialog = document.querySelector('#content-dialog');
const dialogContent = document.querySelector('#dialog-content');
const dialogTitle = document.querySelector('#dialog-title');
let libraryPosition = null;
const sheetBackground = new Map();
let returnFocus;
let dialogMode = '';
let toastTimer;
let youtubeAllowed = false;
const mobilePlayer=window.matchMedia(mobilePlayerQuery);
initMobileViewport(mobilePlayer);
document.querySelectorAll('[data-js-only]').forEach(el => el.hidden = false);

function syncSaved() {
  document.querySelectorAll('.saved-count').forEach(el=>el.textContent=saved.size);
  document.querySelectorAll('[data-save]').forEach(button=>{
    const r = findRecord(button.dataset.save);
    const active = saved.has(r.id);
    button.setAttribute('aria-pressed',String(active));
    button.setAttribute('aria-label',`${active?'Remove':'Save'} ${r.track}${active?' from saved tracks':''}`);
    button.textContent=button.hasAttribute('data-long-label')?(active?'− Saved':'+ Save track'):(active?'−':'+');
  });
  player.setQueue(records.filter(r=>saved.has(r.id)));
}
function notify(message) {
  const toast=document.querySelector('#toast');
  toast.textContent=message;toast.classList.add('visible');clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>toast.classList.remove('visible'),2600);
}
function rememberLibraryPosition() {
  if(!dialog.open||dialogMode!=='library')return;
  const scroll=dialogContent.querySelector('.dialog-scroll');
  if(!scroll)return;
  const top=scroll.getBoundingClientRect().top;
  const row=[...scroll.querySelectorAll('[data-saved-row]')].find(row=>row.getBoundingClientRect().bottom>top+1);
  libraryPosition={top:scroll.scrollTop,id:row?.dataset.savedRow,offset:row?row.getBoundingClientRect().top-top:0};
}
function restoreLibraryPosition() {
  const scroll=dialogContent.querySelector('.dialog-scroll');
  const id=libraryPosition?.id||player.current?.id;
  const row=[...scroll.querySelectorAll('[data-saved-row]')].find(row=>row.dataset.savedRow===id);
  if(row){
    const offset=libraryPosition?.offset??Math.max(0,(scroll.clientHeight-row.offsetHeight)/2);
    scroll.scrollTop+=row.getBoundingClientRect().top-scroll.getBoundingClientRect().top-offset;
  }else scroll.scrollTop=libraryPosition?.top||0;
  scroll.addEventListener('scroll',rememberLibraryPosition,{passive:true});
}
function setSheetBackground(active) {
  document.documentElement.classList.toggle('has-mobile-sheet',active);
  if(active&&!sheetBackground.size){
    for(const element of document.querySelectorAll('#page-content,#analytics-notice')){
      sheetBackground.set(element,element.inert);element.inert=true;
    }
  }else if(!active){
    for(const [element,inert] of sheetBackground)element.inert=inert;
    sheetBackground.clear();
  }
}
function openDialog(content,mode,title) {
  if(dialog.open)rememberLibraryPosition();
  if(!dialog.open) returnFocus=document.activeElement;
  if(player.current){
    if(playerRoot.contains(returnFocus))returnFocus=playerFocusButton();
    setCompactPlayer(true);
  }
  dialogMode=mode;dialogContent.innerHTML=content;dialogTitle.textContent=title;
  dialog.dataset.mode=mode;
  const sheet=mobilePlayer.matches&&Boolean(player.current);
  dialog.classList.toggle('is-player-sheet',sheet);
  if(!dialog.open){
    if(sheet)dialog.show();
    else dialog.showModal();
  }
  setSheetBackground(sheet);
}
function closeDialog() {
  rememberLibraryPosition();setSheetBackground(false);dialog.close();
}
dialog.addEventListener('close',()=>{
  if(dialog.open)return;
  setSheetBackground(false);
  dialogContent.replaceChildren();dialogMode='';dialog.classList.remove('is-player-sheet');
  if((document.activeElement===document.body||dialog.contains(document.activeElement))&&returnFocus?.isConnected&&returnFocus.getClientRects().length)returnFocus.focus({preventScroll:true});
});
dialog.addEventListener('cancel',rememberLibraryPosition);
dialog.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&dialog.classList.contains('is-player-sheet')){
    event.preventDefault();closeDialog();
  }
});
document.querySelector('.close-button').addEventListener('click',closeDialog);
dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;
  const box=dialog.getBoundingClientRect();
  if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeDialog();
});
function resultRow(r) {
  return `<a class="search-result" href="${artistPath(r)}#listen">${coverHTML(media,r,{sizes:'58px'})}<span><strong>${e(r.artist)} <span lang="ko">${e(r.korean)}</span></strong><small>${e(r.track)} · ${r.year}${r===pick?' · Editor’s pick':''}</small></span><span class="result-arrow" aria-hidden="true">↗</span></a>`;
}
function renderLibrary() {
  const list=records.filter(r=>saved.has(r.id));
  const controls=list.length?'<div class="dialog-toolbar library-queue-controls"><button data-play-all title="Play saved tracks from the beginning">Play all</button><button data-previous-track aria-label="Previous saved track">← Previous</button><button data-next-track aria-label="Next saved track">Next →</button><button data-auto-next aria-pressed="true">Auto-next: on</button></div>':'';
  const rows=list.map(r=>`<div class="library-row" data-saved-row="${r.id}"><a class="library-info" href="${artistPath(r)}#listen" aria-label="Read about ${e(r.artist)}: ${e(r.track)}">${coverHTML(media,r,{sizes:'44px'})}<span><strong>${e(r.track)}</strong><small>${e(r.artist)}<span class="library-state"></span></small></span></a>${r.externalOnly?`<a class="library-play library-external" href="${e(r.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${e(r.track)} on YouTube">YouTube ↗</a>`:`<button class="library-play" data-load-saved="${r.id}"></button>`}<button class="save-button library-remove" data-remove="${r.id}" aria-label="Remove ${e(r.track)} from saved tracks" title="Remove from saved tracks">×</button></div>`).join('');
  openDialog(`${controls}<div class="dialog-scroll" tabindex="0" aria-label="Saved tracks">${list.length?`${youtubeAllowed?'':youtubeConsentHTML()}${rows}`:'<p class="empty-state">Save a track with the + button to find it here later.</p><a class="underlink" href="/#records">Browse the listening shelf ↗</a>'}<p class="embed-caption">Saved in this browser. <a href="/privacy-and-terms/">Storage & privacy</a></p></div>`,'library',`Saved · ${list.length}`);
  syncPlayButtons();
  syncQueueControls();restoreLibraryPosition();
}
function toggleSaved(id) {
  const r=records.find(record=>record.id===id);if(!r)return;
  const focused=document.activeElement;
  const rows=[...dialogContent.querySelectorAll('[data-remove]')];
  const index=rows.indexOf(focused);
  saved.has(id)?saved.delete(id):saved.add(id);
  if(saved.has(id))analytics?.trackEvent('save_add',id);
  let persisted=true;
  try {localStorage.setItem(storageKey,JSON.stringify([...saved]));} catch {persisted=false;}
  syncSaved();
  if(dialogMode==='library'){
    renderLibrary();
    const buttons=dialogContent.querySelectorAll('[data-remove]');
    (buttons[Math.min(Math.max(index,0),buttons.length-1)]||dialogContent.querySelector('a'))?.focus({preventScroll:true});
  }
  notify(`${saved.has(id)?'Saved':'Removed'} ${r.track}${persisted?'':' · for this page visit'}`);
}
function renderSearch() {
  openDialog('<form class="dialog-toolbar search-toolbar" role="search"><label class="sr-only" for="search-input">Search by English or Korean artist name, song, release or genre</label><input id="search-input" class="search-input" type="search" placeholder="Artist, song or genre…" autocomplete="off" enterkeyhint="search"><button class="search-done" type="submit">Done</button></form><div class="dialog-scroll" tabindex="0" aria-label="Search results"><div id="search-results"></div><p class="embed-caption" id="search-status" role="status"></p></div>','search','Find music');
  const input=dialogContent.querySelector('#search-input');
  dialogContent.querySelector('form').addEventListener('submit',event=>{event.preventDefault();input.blur();dialogContent.querySelector('.dialog-scroll').focus({preventScroll:true});});
  const update=()=>{
    const matches=searchCatalogue(records,pick,input.value);
    dialogContent.querySelector('#search-results').innerHTML=matches.length?matches.map(resultRow).join(''):'<p class="empty-state">No results found. Try “YdBB”, “Breath” or “한로로”.</p>';
    dialogContent.querySelector('#search-status').textContent=`${matches.length} ${matches.length===1?'result':'results'} in this edition.`;
    dialogContent.querySelector('.dialog-scroll').scrollTop=0;
  };
  input.addEventListener('input',update);update();input.focus({preventScroll:true});
}

const playerRoot=document.querySelector('#persistent-player');
const pageScroll=createPageScroll();
const player=createPlayer(playerRoot,{onChange:syncPlayer,onPlay:id=>analytics?.trackEvent('play_start',id)});
const playerSizeButton=playerRoot.querySelector('[data-resize-player]');
const playerBackdrop=document.querySelector('#player-backdrop');
const playlist=playerRoot.querySelector('[data-player-playlist]');
const playlistRows=playerRoot.querySelector('[data-playlist-rows]');
const inertBackground=new Map();
let playerReturnFocus;
function setCompactPlayer(compact) {
  compact=mobilePlayer.matches||compact;
  const expanded=Boolean(player.current)&&!compact;
  playerRoot.classList.toggle('is-compact',compact);
  playerSizeButton.textContent=compact?'Expand':'Minimize';
  playerSizeButton.setAttribute('aria-label',compact?'Expand listening window':'Minimize and keep listening');
  playerSizeButton.hidden=mobilePlayer.matches;
  playerRoot.querySelector('[data-mobile-queue]').hidden=!mobilePlayer.matches;
  playerRoot.setAttribute('role',expanded?'dialog':'region');
  if(expanded)playerRoot.setAttribute('aria-modal','true');
  else playerRoot.removeAttribute('aria-modal');
  playerBackdrop.hidden=!expanded;
  document.body.classList.toggle('player-expanded',expanded);
  pageScroll.setCompact(Boolean(player.current)&&compact);
  playerRoot.querySelectorAll('[data-player-focus]').forEach(el=>el.hidden=!expanded);
  if(expanded&&!inertBackground.size){
    for(const element of document.body.children){
      if(element===playerRoot||element===playerBackdrop)continue;
      inertBackground.set(element,element.inert);
      element.inert=true;
    }
  }else if(!expanded){
    for(const [element,inert] of inertBackground)element.inert=inert;
    inertBackground.clear();
  }
}
function syncQueueControls() {
  document.querySelectorAll('[data-previous-track]').forEach(button=>button.disabled=!player.ready||!player.previous);
  document.querySelectorAll('[data-next-track]').forEach(button=>button.disabled=!player.ready||!player.next);
  document.querySelectorAll('[data-auto-next]').forEach(button=>{
    button.setAttribute('aria-pressed',String(player.autoNext));
    button.textContent=`Auto-next: ${player.autoNext?'on':'off'}`;
  });
}
function syncPlaylist() {
  const list=records.filter(r=>saved.has(r.id));
  const focused=playlistRows.contains(document.activeElement)?document.activeElement.dataset.loadSaved:null;
  playlist.hidden=!list.length;
  playerRoot.classList.toggle('has-playlist',Boolean(list.length));
  playerRoot.querySelector('[data-playlist-count]').textContent=String(list.length).padStart(2,'0');
  playlistRows.innerHTML=list.map(r=>{
    const selected=r.id===player.current?.id;
    const content=`${coverHTML(media,r,{sizes:'48px'})}<span><strong>${e(r.track)}</strong><small>${e(r.artist)}</small></span><span class="playlist-status">${selected?(player.state==='playing'?'Playing':'Selected'):r.externalOnly?'YouTube ↗':'▷'}</span>`;
    return `<li>${r.externalOnly?`<a href="${e(r.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${e(r.track)} by ${e(r.artist)} on YouTube">${content}</a>`:`<button data-load-saved="${r.id}" aria-label="${selected?'Return to':'Load'} ${e(r.track)} by ${e(r.artist)}" ${selected?'aria-current="true"':''}>${content}</button>`}</li>`;
  }).join('');
  playerRoot.querySelector('[data-queue-controls]').hidden=!list.length;
  syncQueueControls();
  const status=playerRoot.querySelector('[data-playback-status]');
  status.textContent=({idle:'',loading:'Starting playback…',ready:'Starting playback…',paused:'Paused.',
    playing:player.autoNext&&player.next?`Up next: ${player.next.track} · ${player.next.artist}`:'Playing · Stops after this song.',
    ended:'Song finished. Choose a track to listen again.',blocked:'Press play in the video to continue.',
    error:'This video is unavailable here. Please choose another track.',
    unavailable:'Automatic next is unavailable. You can still play this video or choose another track.',
  })[player.state];
  playerRoot.classList.toggle('needs-attention',['blocked','error','unavailable'].includes(player.state));
  if(focused)(playlistRows.querySelector(`[data-load-saved="${focused}"]`)||playerFocusButton()).focus({preventScroll:true});
}
const playerFocusButton=()=>mobilePlayer.matches?playerRoot.querySelector('[data-mobile-queue]'):playerSizeButton;
function loadPlayer(id, button, {playAll=false}={}) {
  const record=findRecord(id);
  if(!record||record.externalOnly)return;
  const fromPlaylist=playlistRows.contains(button);
  if(dialog.open){
    if(!playerRoot.contains(returnFocus))playerReturnFocus=returnFocus;
    returnFocus=playerFocusButton();
    closeDialog();
  }else if(!playerRoot.contains(button))playerReturnFocus=button;
  youtubeAllowed=true;
  if(playAll)player.playAll();
  else player.load(record,{autoplay:true});
  setCompactPlayer(mobilePlayer.matches);
  (fromPlaylist&&!mobilePlayer.matches?playlistRows.querySelector(`[data-load-saved="${id}"]`):playerFocusButton())?.focus({preventScroll:true});
}
mobilePlayer.addEventListener('change',()=>{
  if(dialog.open)closeDialog();
  setCompactPlayer(playerRoot.classList.contains('is-compact'));
});
playerBackdrop.addEventListener('click',()=>{setCompactPlayer(true);playerFocusButton().focus({preventScroll:true});});
playerRoot.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!playerRoot.classList.contains('is-compact')){
    event.preventDefault();setCompactPlayer(true);playerFocusButton().focus({preventScroll:true});
  }
});
playerRoot.querySelectorAll('[data-player-focus]').forEach(guard=>guard.addEventListener('focus',()=>{
  const controls=[...playerRoot.querySelectorAll('a,button,iframe')].filter(el=>el.getClientRects().length);
  (guard.dataset.playerFocus==='start'?controls.at(-1):controls[0])?.focus();
}));
playerRoot.addEventListener('click',event=>{
  if(event.target.closest('a[data-current-track]'))setCompactPlayer(true);
});
new ResizeObserver(()=>{
  const height=playerRoot.getBoundingClientRect().height;
  document.documentElement.style.setProperty('--player-clearance',`${Math.ceil(height)+36}px`);
  document.documentElement.style.setProperty('--mobile-player-height',`${Math.ceil(height)}px`);
}).observe(playerRoot);
function syncPlayButtons() {
  document.querySelectorAll('[data-play-all]').forEach(button=>{
    button.textContent=youtubeAllowed?'Play all':'Agree & play all';
    button.setAttribute('aria-label',`${button.textContent}: saved tracks from the beginning`);
    button.disabled=!saved.size;
  });
  document.querySelectorAll('[data-load-player],.library-play[data-load-saved]').forEach(button=>{
    const record=findRecord(button.dataset.loadPlayer||button.dataset.loadSaved);
    const selected=record.id===player.current?.id;
    const returning=selected&&['playing','loading'].includes(player.state);
    const text=returning?'Return to player':youtubeAllowed?'Play':'Agree & play';
    const library=button.classList.contains('library-play');
    button.textContent=library&&youtubeAllowed?(returning?'↗':'▷'):text;
    button.setAttribute('aria-label',`${text}: ${record.track} by ${record.artist}`);
    button.title=text;
    if(library){
      button.classList.toggle('needs-consent',!youtubeAllowed);
      if(selected)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');
      button.closest('.library-row').classList.toggle('is-current',selected);
      button.closest('.library-row').querySelector('.library-state').textContent=selected?` · ${player.state==='playing'?'Playing':'Selected'}`:'';
    }
    const disconnect=button.closest('.player-shell')?.querySelector('[data-unload-player]');
    if(disconnect)disconnect.hidden=!selected;
  });
  document.querySelectorAll('[data-youtube-consent]').forEach(el=>el.hidden=youtubeAllowed);
}
function syncPlayer() {
  syncPlayButtons();
  syncPlaylist();
}
function closePlayer() {
  const id=player.current?.id;
  if(dialog.open&&dialog.classList.contains('is-player-sheet'))closeDialog();
  player.close();
  setCompactPlayer(false);
  const button=[...document.querySelectorAll('[data-load-player]')].find(button=>button.dataset.loadPlayer===id);
  (playerReturnFocus?.isConnected?playerReturnFocus:button||document.querySelector('.search-button')).focus({preventScroll:true});
  notify('YouTube disconnected.');
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-share-page')){ sharePage(button); }
  else if(button.hasAttribute('data-save'))toggleSaved(button.dataset.save);
  else if(button.hasAttribute('data-remove'))toggleSaved(button.dataset.remove);
  else if(button.hasAttribute('data-search'))renderSearch();
  else if(button.hasAttribute('data-library'))renderLibrary();
  else if(button.hasAttribute('data-load-player'))loadPlayer(button.dataset.loadPlayer,button);
  else if(button.hasAttribute('data-load-saved'))loadPlayer(button.dataset.loadSaved,button);
  else if(button.hasAttribute('data-play-all'))loadPlayer(records.find(r=>saved.has(r.id)&&!r.externalOnly)?.id,button,{playAll:true});
  else if(button.hasAttribute('data-next-track'))player.nextTrack();
  else if(button.hasAttribute('data-previous-track'))player.previousTrack();
  else if(button.hasAttribute('data-auto-next'))player.setAutoNext(!player.autoNext);
  else if(button.hasAttribute('data-unload-player'))closePlayer();
  else if(button.hasAttribute('data-resize-player'))setCompactPlayer(!playerRoot.classList.contains('is-compact'));
  else if(button.hasAttribute('data-filter')){
    const filter=button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));
    let count=0;
    document.querySelectorAll('.record-card').forEach(card=>{card.hidden=filter!=='all'&&card.dataset.category!==filter;if(!card.hidden)count++;});
    document.querySelector('#record-count').textContent=`${String(count).padStart(2,'0')} ${count===1?'TRACK':'TRACKS'}`;
  }
});
window.addEventListener('storage',event=>{
  if(event.key===storageKey||event.key===null){
    saved=readSaved(event.newValue,records);syncSaved();
    if(dialogMode==='library')renderLibrary();
  }
});
window.addEventListener('pagehide',()=>{player.close();setCompactPlayer(false);});
syncSaved();
const analytics=initAnalytics({...catalogue.site.analytics,trackIds:all.map(r=>r.id),contentPaths:['/','/notes/first-listens/',...all.map(artistPath),...getListeningGuides(catalogue).map(guidePath)]}, catalogue.site.url);

async function sharePage(button) {
  const url=document.querySelector('link[rel="canonical"]').href;
  const path=new URL(url).pathname;
  button.disabled=true;
  try {
    if(navigator.share)await navigator.share({title:document.title,url});
    else { await navigator.clipboard.writeText(url);notify('Link copied.'); }
    analytics?.trackEvent('share',path);
  } catch(error) {
    if(error.name!=='AbortError') {
      openDialog(`<div class="dialog-scroll"><p>Your browser could not share automatically. Copy this link to share the page.</p><label class="sr-only" for="share-url">Page link</label><input class="share-url" id="share-url" type="url" readonly value="${e(url)}"></div>`,'share','Share this page');
      const input=dialogContent.querySelector('#share-url');input.focus();input.select();
    }
  } finally {button.disabled=false;}
}

function initArtistCarousel() {
  const carousel=document.querySelector('#artist-carousel');if(!carousel)return;
  const slidesRoot=carousel.querySelector('#hero-slides');
  const selectors=carousel.querySelector('#hero-artists');
  const rotation=carousel.querySelector('#hero-rotation');
  const position=carousel.querySelector('#hero-position');
  const status=carousel.querySelector('#hero-status');
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const interval=9000;
  let current=0,wantsRotation=!reducedMotion.matches,hovered=window.matchMedia('(hover: hover)').matches&&carousel.matches(':hover'),inView=false,timer,touchStart,suppressClick=false,rotationPress;
  const slides=[...slidesRoot.children];
  selectors.innerHTML=features.map((feature,index)=>`<button data-feature="${index}" aria-controls="hero-${feature.id}" aria-pressed="${index===0}" aria-label="Show ${e(findRecord(feature.id).artist)}"><span class="mono" aria-hidden="true">${formatPosition(index+1)}</span>${e(findRecord(feature.id).artist)}</button>`).join('');
  const choices=[...selectors.children];
  carousel.setAttribute('role','region');carousel.setAttribute('aria-roledescription','carousel');
  carousel.querySelector('.hero-toolbar').hidden=false;selectors.hidden=false;
  carousel.classList.add('is-ready');slides.forEach(slide=>slide.hidden=false);
  function activateImage(slide){
    const image=slide.querySelector('img[data-src]');if(!image)return;
    image.loading='eager';image.srcset=image.dataset.srcset;image.src=image.dataset.src;
    delete image.dataset.srcset;delete image.dataset.src;
  }
  function syncRotation(){
    window.clearTimeout(timer);
    rotation.setAttribute('aria-label',wantsRotation?'Pause artist rotation':'Start artist rotation');
    rotation.innerHTML=wantsRotation?'<span aria-hidden="true">Ⅱ</span> Pause':'<span aria-hidden="true">▷</span> Play';
    slidesRoot.setAttribute('aria-live','off');
    if(wantsRotation&&!hovered&&inView&&!document.hidden&&!dialog.open){
      timer=window.setTimeout(()=>show(current+1),interval);
    }
  }
  function stop(){wantsRotation=false;syncRotation();}
  function show(index,manual=false){
    if(manual)wantsRotation=false;
    current=(index+slides.length)%slides.length;
    activateImage(slides[current]);
    slides.forEach((slide,i)=>{
      const active=i===current;
      slide.classList.toggle('is-active',active);
      slide.inert=!active;
      if(active)slide.removeAttribute('aria-hidden');
      else slide.setAttribute('aria-hidden','true');
      choices[i].setAttribute('aria-pressed',String(active));
    });
    position.textContent=`${formatPosition(current+1)} / ${formatPosition(slides.length)}`;
    if(manual)status.textContent=`${findRecord(features[current].id).artist}, ${current+1} of ${slides.length}`;
    syncRotation();
  }
  rotation.addEventListener('click',()=>{
    wantsRotation=!(rotationPress??wantsRotation);
    rotationPress=undefined;
    syncRotation();
  });
  carousel.querySelector('#hero-previous').addEventListener('click',()=>show(current-1,true));
  carousel.querySelector('#hero-next').addEventListener('click',()=>show(current+1,true));
  selectors.addEventListener('click',event=>{
    const button=event.target.closest('[data-feature]');
    if(button)show(Number(button.dataset.feature),true);
  });
  selectors.addEventListener('keydown',event=>{
    const index=choices.indexOf(event.target);
    if(index<0||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?choices.length-1:(index+(event.key==='ArrowRight'?1:-1)+choices.length)%choices.length;
    choices[next].focus();
    show(next,true);
  });
  carousel.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){hovered=true;syncRotation();}});
  carousel.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'){hovered=false;syncRotation();}});
  // Keyboard focus stops rotation until Play is explicitly requested.
  // Pointer presses are handled before focus so the Play/Pause button never flips twice.
  rotation.addEventListener('pointerdown',()=>{rotationPress=wantsRotation;});
  rotation.addEventListener('pointercancel',()=>{rotationPress=undefined;});
  carousel.addEventListener('focusin',()=>stop());
  // Native vertical scrolling is preserved; horizontal touch swipes choose an artist.
  slidesRoot.addEventListener('pointerdown',event=>{
    suppressClick=false;
    if(event.pointerType==='touch')touchStart={x:event.clientX,y:event.clientY};
  });
  slidesRoot.addEventListener('pointerup',event=>{
    if(!touchStart)return;
    const dx=event.clientX-touchStart.x,dy=event.clientY-touchStart.y;
    touchStart=null;
    if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5){suppressClick=true;show(current+(dx<0?1:-1),true);}
  });
  slidesRoot.addEventListener('pointercancel',()=>{touchStart=null;});
  slidesRoot.addEventListener('click',event=>{
    if(suppressClick){suppressClick=false;event.preventDefault();event.stopPropagation();}
  },true);
  document.addEventListener('visibilitychange',syncRotation);
  dialog.addEventListener('close',syncRotation);
  const mutation=new MutationObserver(syncRotation);
  mutation.observe(dialog,{attributes:true,attributeFilter:['open']});
  const intersection=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;syncRotation();},{threshold:0.25});
  intersection.observe(carousel);
  const motionChange=()=>{if(reducedMotion.matches)stop();};
  reducedMotion.addEventListener('change',motionChange);
  show(0);
  return ()=>{
    window.clearTimeout(timer);
    mutation.disconnect();intersection.disconnect();
    document.removeEventListener('visibilitychange',syncRotation);
    dialog.removeEventListener('close',syncRotation);
    reducedMotion.removeEventListener('change',motionChange);
  };
}
let cleanupCarousel=initArtistCarousel();
initNavigation({
  scroll:pageScroll, closeDialog,
  beforeSwap:()=>{if(player.current)setCompactPlayer(true);cleanupCarousel?.();},
  afterSwap:()=>{
    document.querySelectorAll('[data-js-only]').forEach(el=>el.hidden=false);
    syncSaved();syncPlayer();analytics?.refreshControls();
    cleanupCarousel=initArtistCarousel();
  },
  onNavigate:referrer=>analytics?.trackPageView(referrer),
  onError:()=>notify('This page could not be loaded. Please try the link again.'),
});
