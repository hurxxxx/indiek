import catalogue from './catalogue.js';
import {initAnalytics} from './analytics.mjs';
import {initNavigation, createPageScroll} from './navigation.mjs';
import {createPlayer} from './player.mjs';
import {escapeHTML as e, artistPath, coverHTML, readSaved, searchCatalogue, getFeaturedArtists, formatPosition, youtubeConsentHTML} from './shared.mjs';

const {records, editorPick: pick, media} = catalogue;
const features = getFeaturedArtists(catalogue);
const all = [...records,pick];
const findRecord = id => all.find(r => r.id === id);
const storageKey = 'indiek-saved-v1';
let saved;
try { saved = readSaved(localStorage.getItem(storageKey),records); } catch { saved = new Set(); }
const dialog = document.querySelector('#content-dialog');
const dialogContent = document.querySelector('#dialog-content');
let returnFocus;
let dialogMode = '';
let toastTimer;
let youtubeAllowed = false;
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
function openDialog(content,mode) {
  if(!dialog.open) returnFocus=document.activeElement;
  if(player.current){
    if(playerRoot.contains(returnFocus))returnFocus=playerSizeButton;
    setCompactPlayer(true);
  }
  dialogMode=mode;dialogContent.innerHTML=content;
  if(!dialog.open)dialog.showModal();
  dialog.scrollTop=0;
}
dialog.addEventListener('close',()=>{
  dialogContent.replaceChildren();dialogMode='';
  if(returnFocus?.isConnected)returnFocus.focus();
});
document.querySelector('.close-button').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;
  const box=dialog.getBoundingClientRect();
  if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();
});
function resultRow(r) {
  return `<a class="search-result" href="${artistPath(r)}#listen">${coverHTML(media,r,{sizes:'58px'})}<span><strong>${e(r.artist)} <span lang="ko">${e(r.korean)}</span></strong><small>${e(r.track)} · ${r.year}${r===pick?' · Editor’s pick':''}</small></span><span class="result-arrow" aria-hidden="true">↗</span></a>`;
}
function renderLibrary() {
  const list=records.filter(r=>saved.has(r.id));
  openDialog(`<p class="eyebrow dialog-eyebrow">YOUR LISTENING SHELF</p><h2 id="dialog-title" class="dialog-title">Your saved tracks.</h2>${list.length?`<p class="library-intro">Start anywhere. With Auto-next on, the songs continue in the order shown.</p>${youtubeAllowed?'':youtubeConsentHTML()}${list.map(r=>`<div class="library-row">${resultRow(r)}<div class="library-actions">${r.externalOnly?`<a class="library-play" href="${e(r.url)}" target="_blank" rel="noopener noreferrer">YouTube ↗</a>`:`<button class="library-play" data-load-saved="${r.id}"></button>`}<button class="save-button" data-remove="${r.id}" aria-label="Remove ${e(r.track)} from saved tracks">Remove</button></div></div>`).join('')}`:'<p class="empty-state">Save a track with the + button to find it here later.</p><a class="underlink" href="/#records">Browse the listening shelf ↗</a>'}<p class="embed-caption">Your saved tracks stay in this browser. <a href="/privacy-and-terms/">Storage & privacy</a></p>`,'library');
  syncPlayButtons();
}
function toggleSaved(id) {
  const r=records.find(record=>record.id===id);if(!r)return;
  const focused=document.activeElement;
  const rows=[...dialogContent.querySelectorAll('[data-remove]')];
  const index=rows.indexOf(focused);
  saved.has(id)?saved.delete(id):saved.add(id);
  let persisted=true;
  try {localStorage.setItem(storageKey,JSON.stringify([...saved]));} catch {persisted=false;}
  syncSaved();
  if(dialogMode==='library'){
    renderLibrary();
    const buttons=dialogContent.querySelectorAll('[data-remove]');
    (buttons[Math.min(Math.max(index,0),buttons.length-1)]||dialogContent.querySelector('a'))?.focus();
  }
  notify(`${saved.has(id)?'Saved':'Removed'} ${r.track}${persisted?'':' · for this page visit'}`);
}
function renderSearch() {
  openDialog('<p class="eyebrow dialog-eyebrow">SEARCH THE JOURNAL</p><h2 id="dialog-title" class="dialog-title">Find an artist or song.</h2><label class="sr-only" for="search-input">Search by English or Korean artist name, song, release or genre</label><input id="search-input" class="search-input" type="search" placeholder="Artist, song or genre…" autocomplete="off"><div id="search-results"></div><p class="embed-caption" id="search-status" role="status"></p>','search');
  const input=dialogContent.querySelector('#search-input');
  const update=()=>{
    const matches=searchCatalogue(records,pick,input.value);
    dialogContent.querySelector('#search-results').innerHTML=matches.length?matches.map(resultRow).join(''):'<p class="empty-state">No results found. Try “YdBB”, “Breath” or “한로로”.</p>';
    dialogContent.querySelector('#search-status').textContent=`${matches.length} ${matches.length===1?'result':'results'} in this edition.`;
  };
  input.addEventListener('input',update);update();input.focus();
}

const playerRoot=document.querySelector('#persistent-player');
const pageScroll=createPageScroll();
const player=createPlayer(playerRoot,{onChange:syncPlayer});
const playerSizeButton=playerRoot.querySelector('[data-resize-player]');
const playerBackdrop=document.querySelector('#player-backdrop');
const playlist=playerRoot.querySelector('[data-player-playlist]');
const playlistRows=playerRoot.querySelector('[data-playlist-rows]');
const inertBackground=new Map();
let playerReturnFocus;
function setCompactPlayer(compact) {
  const expanded=Boolean(player.current)&&!compact;
  playerRoot.classList.toggle('is-compact',compact);
  playerSizeButton.textContent=compact?'Expand':'Minimize';
  playerSizeButton.setAttribute('aria-label',compact?'Expand listening window':'Minimize and keep listening');
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
  playerRoot.querySelector('[data-previous-track]').disabled=!player.ready||!player.previous;
  playerRoot.querySelector('[data-next-track]').disabled=!player.ready||!player.next;
  const autoNextButton=playerRoot.querySelector('[data-auto-next]');
  autoNextButton.setAttribute('aria-pressed',String(player.autoNext));
  autoNextButton.textContent=`Auto-next: ${player.autoNext?'on':'off'}`;
  const status=playerRoot.querySelector('[data-playback-status]');
  status.textContent=({idle:'',loading:'Starting playback…',ready:'Starting playback…',paused:'Paused.',
    playing:player.autoNext&&player.next?`Up next: ${player.next.track} · ${player.next.artist}`:'Playing · Stops after this song.',
    ended:'Song finished. Choose a track to listen again.',blocked:'Press play in the video to continue.',
    error:'This video is unavailable here. Choose another track or open it on YouTube.',
    unavailable:'Automatic next is unavailable. You can still play this video or choose another track.',
  })[player.state];
  const watchLink=playerRoot.querySelector('[data-player-youtube]');
  watchLink.hidden=!['error','unavailable'].includes(player.state);
  watchLink.href=player.current?.url||'#';
  playerRoot.classList.toggle('needs-attention',['blocked','error','unavailable'].includes(player.state));
  if(focused)(playlistRows.querySelector(`[data-load-saved="${focused}"]`)||playerSizeButton).focus({preventScroll:true});
}
function loadPlayer(id, button) {
  const record=findRecord(id);
  if(!record||record.externalOnly)return;
  const fromPlaylist=playlistRows.contains(button);
  if(dialog.open){
    if(!playerRoot.contains(returnFocus))playerReturnFocus=returnFocus;
    returnFocus=playerSizeButton;
    dialog.close();
  }else if(!playerRoot.contains(button))playerReturnFocus=button;
  youtubeAllowed=true;
  player.load(record,{autoplay:true});
  setCompactPlayer(false);
  (fromPlaylist?playlistRows.querySelector(`[data-load-saved="${id}"]`):playerSizeButton)?.focus({preventScroll:true});
}
playerBackdrop.addEventListener('click',()=>{setCompactPlayer(true);playerSizeButton.focus({preventScroll:true});});
playerRoot.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!playerRoot.classList.contains('is-compact')){
    event.preventDefault();setCompactPlayer(true);playerSizeButton.focus({preventScroll:true});
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
  document.querySelectorAll('[data-load-player],.library-play[data-load-saved]').forEach(button=>{
    const record=findRecord(button.dataset.loadPlayer||button.dataset.loadSaved);
    const selected=record.id===player.current?.id;
    const returning=selected&&['playing','loading'].includes(player.state);
    const text=returning?'Return to player':youtubeAllowed?'Play':'Agree & play';
    button.textContent=text;
    button.setAttribute('aria-label',`${text}: ${record.track} by ${record.artist}`);
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
  player.close();
  setCompactPlayer(false);
  const button=[...document.querySelectorAll('[data-load-player]')].find(button=>button.dataset.loadPlayer===id);
  (playerReturnFocus?.isConnected?playerReturnFocus:button||document.querySelector('.search-button')).focus({preventScroll:true});
  notify('YouTube disconnected.');
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-save'))toggleSaved(button.dataset.save);
  else if(button.hasAttribute('data-remove'))toggleSaved(button.dataset.remove);
  else if(button.hasAttribute('data-search'))renderSearch();
  else if(button.hasAttribute('data-library'))renderLibrary();
  else if(button.hasAttribute('data-load-player'))loadPlayer(button.dataset.loadPlayer,button);
  else if(button.hasAttribute('data-load-saved'))loadPlayer(button.dataset.loadSaved,button);
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
const analytics=initAnalytics(catalogue.site.analytics, catalogue.site.url);

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
  scroll:pageScroll,
  beforeSwap:()=>{if(player.current)setCompactPlayer(true);cleanupCarousel?.();},
  afterSwap:()=>{
    document.querySelectorAll('[data-js-only]').forEach(el=>el.hidden=false);
    syncSaved();syncPlayer();analytics?.refreshControls();
    cleanupCarousel=initArtistCarousel();
  },
  onNavigate:referrer=>analytics?.trackPageView(referrer),
  onError:()=>notify('This page could not be loaded. Please try the link again.'),
});
