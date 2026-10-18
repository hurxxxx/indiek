'use strict';

// Replace this small, verified catalogue to create the next editorial edition.
const records = [
  {
    "id": "ydbb",
    "artist": "YdBB",
    "korean": "유다빈밴드",
    "aliases": "Yudabinband Yudabin Band Yu Dabin Band",
    "album": "ONCE",
    "release": "ONCE",
    "year": "2023",
    "genre": "INDIE ROCK",
    "category": "bands",
    "image": "ydbb-once.jpg",
    "track": "ONCE",
    "koreanTitle": "",
    "duration": "03:35",
    "provider": "youtube",
    "videoId": "vyTiHwIK2LU",
    "channel": "YdBB - Topic",
    "url": "https://www.youtube.com/watch?v=vyTiHwIK2LU",
    "note": "A farewell, held a little longer.",
    "description": "YdBB are a five-piece band whose music moves between acoustic folk and rock. On this 2023 single, they turn toward the moment of letting someone go — and the wish to be remembered kindly.",
    "source": "https://www.genie.co.kr/magazine/subMain?ctid=1&mgz_seq=13700",
    "sourceName": "YdBB — ONCE interview on Genie"
  },
  {
    "id": "whiteusedsocks",
    "artist": "WhiteUsedSocks",
    "korean": "화이트유즈드삭스",
    "aliases": "White used socks",
    "album": "Don’t feel sad",
    "release": "Don’t feel sad",
    "year": "2017",
    "genre": "ROCK",
    "category": "bands",
    "image": "whiteusedsocks-dont-feel-sad.jpg",
    "track": "Don’t feel sad",
    "koreanTitle": "",
    "duration": "04:28",
    "provider": "youtube",
    "videoId": "2uIKfZZB8FA",
    "channel": "Whiteusedsocks - Topic",
    "url": "https://www.youtube.com/watch?v=2uIKfZZB8FA",
    "note": "Start at the beginning: a 2017 single.",
    "description": "A first encounter with WhiteUsedSocks, through their June 2017 single. Written and composed by Jung Jaeheon, “Don’t feel sad” is our starting point for exploring the band’s catalogue.",
    "source": "https://whiteusedsocks.com/don%27t-feel-sad",
    "sourceName": "WhiteUsedSocks — official release page"
  },
  {
    "id": "motte",
    "artist": "Motte",
    "korean": "모트",
    "aliases": "",
    "album": "Don’t run away",
    "release": "A-TEEN Part.4",
    "year": "2018",
    "genre": "POP / OST",
    "category": "solo",
    "image": "motte-dont-run-away.jpg",
    "track": "Don’t run away",
    "koreanTitle": "도망가지마",
    "duration": "04:08",
    "provider": "youtube",
    "videoId": "Xu56OVkwdXw",
    "channel": "Motte - Topic",
    "url": "https://www.youtube.com/watch?v=Xu56OVkwdXw",
    "note": "Meet Motte through the world of A-TEEN.",
    "description": "Singer-songwriter Motte’s “Don’t run away” appeared on the soundtrack to the Korean web drama A-TEEN in September 2018. You can start with the song whether or not you have seen the series.",
    "source": "https://music.apple.com/us/album/a-teen-original-soundtrack-pt-4-single/1436476166",
    "sourceName": "Motte — A-TEEN Part.4 on Apple Music"
  },
  {
    "id": "hanroro",
    "artist": "HANRORO",
    "korean": "한로로",
    "aliases": "Han Roro",
    "album": "Even if you leave",
    "release": "Even if you leave,",
    "year": "2023",
    "genre": "ROCK",
    "category": "solo",
    "image": "hanroro-even-if-you-leave.jpg",
    "track": "Even if you leave",
    "koreanTitle": "자처",
    "duration": "04:32",
    "provider": "youtube",
    "videoId": "QRwfXQ7-OR4",
    "channel": "HANRORO - Topic",
    "url": "https://www.youtube.com/watch?v=QRwfXQ7-OR4",
    "note": "On regret, attachment and moving forward.",
    "description": "Written and composed by HANRORO, “Even if you leave” (자처) was released in April 2023. The song reflects on attachment and self-blame, and the slow work of carrying on after something has ended.",
    "source": "https://poclanos.com/album/52690/",
    "sourceName": "HANRORO — official release notes on POCLANOS"
  }
];
const storageKey='indiek-saved-v1';
let saved=new Set();
try {const value=JSON.parse(localStorage.getItem(storageKey)||'[]');if(Array.isArray(value))saved=new Set(value.filter(id=>records.some(r=>r.id===id)));} catch { /* The journal also works when storage is unavailable. */ }
const dialog=document.querySelector('#content-dialog');
const dialogContent=document.querySelector('#dialog-content');
let dialogMode='';
let activeFilter='all';
let toastTimer;
let returnFocus;
let dialogTrigger;
const findRecord=id=>records.find(r=>r.id===id);
const cover=r=>`<img src="assets/${r.image}" alt="${r.release||r.album} release artwork" width="350" height="350" loading="lazy">`;
const saveButton=r=>`<button class="save-button" data-save="${r.id}" aria-label="${saved.has(r.id)?'Remove':'Save'} ${r.album}${saved.has(r.id)?' from saved records':''}" aria-pressed="${saved.has(r.id)}">${saved.has(r.id)?'−':'+'}</button>`;

function renderRecords(){
  document.querySelector('#record-grid').innerHTML=records.map(r=>`<article class="record-card" data-category="${r.category}" ${activeFilter!=='all'&&activeFilter!==r.category?'hidden':''}><div class="record-cover"><button class="cover-button" data-listen="${r.id}" aria-label="Listen to ${r.album} by ${r.artist}">${cover(r)}<span class="cover-listen">OPEN TRACK <span aria-hidden="true">↗</span></span></button></div><div class="record-meta mono"><span>${r.genre} · ${r.year}</span>${saveButton(r)}</div><h3><button data-listen="${r.id}">${r.album}</button></h3><p class="record-artist">${r.artist}</p><p class="record-note">${r.note}</p></article>`).join('');
  const count=records.filter(r=>activeFilter==='all'||r.category===activeFilter).length;
  document.querySelector('#record-count').textContent=`${String(count).padStart(2,'0')} ${count===1?'TRACK':'TRACKS'}`;
  document.querySelectorAll('.saved-count').forEach(el=>el.textContent=saved.size);
}
document.querySelector('#track-list').innerHTML=records.map((r,i)=>`<button class="track" data-listen="${r.id}" aria-label="Listen to ${r.track} by ${r.artist}"><span class="track-number">0${i+1}</span>${cover(r)}<span class="track-info"><strong>${r.track}</strong><span>${r.artist}</span></span><span class="track-time">${r.duration}</span><span class="track-play" aria-hidden="true">▷</span></button>`).join('');

function openDialog(content,mode){
  const wasOpen=dialog.open;
  if(!wasOpen){returnFocus=dialogTrigger||document.activeElement;dialogTrigger=null;}
  dialogMode=mode;dialogContent.innerHTML=content;
  if(!wasOpen)dialog.showModal();
  dialog.scrollTop=0;
}
function closeDialog(){dialog.close();}
dialog.addEventListener('close',()=>{dialogContent.innerHTML='';dialogMode='';if(returnFocus?.isConnected)returnFocus.focus();});
document.querySelector('.close-button').addEventListener('click',closeDialog);
dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeDialog();}});

function openRecord(id){
  const r=findRecord(id);if(!r)return;
  const platform=r.provider==='youtube'?'YouTube':'Bandcamp';
  openDialog(`<div class="album-detail">${cover(r)}<div><p class="eyebrow dialog-eyebrow">${r.genre} / ${r.year}</p><h2 id="dialog-title" class="dialog-title">${r.track}${r.koreanTitle?` <span class="track-korean" lang="ko">${r.koreanTitle}</span>`:''}</h2><p>${r.artist} <span lang="ko">${r.korean}</span></p><div class="detail-actions"><a class="underlink" href="${r.url}" target="_blank" rel="noopener noreferrer">${r.provider==='youtube'?'Listen on YouTube':'Visit the artist on Bandcamp'} ↗</a><button class="save-button" data-save="${r.id}" data-long-label aria-pressed="${saved.has(r.id)}">${saved.has(r.id)?'− Saved':'+ Save track'}</button></div></div></div><p class="track-description">${r.description}</p><div class="embed-shell ${r.provider==='youtube'?'youtube-shell':''}"><div class="player-prompt"><p>Listen to “${r.track}” via ${r.provider==='youtube'?r.channel:'the artist’s official Bandcamp player'}.</p><button class="room-button" data-load-player="${r.id}"><span class="play-triangle" aria-hidden="true"></span> Load ${platform} player <span aria-hidden="true">↗</span></button></div></div><p class="embed-caption">Music plays only when you press play. If the player is unavailable, <a href="${r.url}" target="_blank" rel="noopener noreferrer">listen directly on ${platform} ↗</a>.</p><p class="embed-caption">Release information: <a href="${r.source}" target="_blank" rel="noopener noreferrer">${r.sourceName} ↗</a></p>`,'record');
}
function youtubeFrame(videoId,title){
  const frame=document.createElement('iframe');
  frame.title=title;
  frame.src=`https://www.youtube-nocookie.com/embed/${videoId}`;
  frame.allow='encrypted-media; fullscreen; picture-in-picture';
  frame.allowFullscreen=true;
  frame.referrerPolicy='strict-origin-when-cross-origin';
  return frame;
}
function loadPlayer(id){
  const r=findRecord(id);if(!r)return;
  const shell=dialogContent.querySelector('.embed-shell');
  let frame;
  if(r.provider==='youtube'){
    frame=youtubeFrame(r.videoId,`${r.track} by ${r.artist} — ${r.channel}`);
    // Unload another player before opening this one to prevent overlapping music.
    const pickFrame=document.querySelector('#pick-video-stage iframe');
    if(pickFrame)pickFrame.replaceWith(videoPrompt.cloneNode(true));
  }else{
    frame=document.createElement('iframe');
    frame.title=`Bandcamp player: ${r.track} by ${r.artist}`;
    frame.src=`https://bandcamp.com/EmbeddedPlayer/album=${r.albumId}/size=large/bgcol=f5f3ed/linkcol=c83b26/tracklist=false/artwork=none/track=${r.trackId}/transparent=true/`;
    frame.allow='encrypted-media';frame.referrerPolicy='strict-origin-when-cross-origin';
  }
  shell.replaceChildren(frame);
  frame.focus();
}
const videoPrompt=document.querySelector('#pick-video-stage .video-prompt').cloneNode(true);

function loadVideo(){
  const stage=document.querySelector('#pick-video-stage');
  if(stage.querySelector('iframe'))return;
  const frame=youtubeFrame('knmrNkQMybA','Breath (숨) by Yoon Mirae — official music video via 1theK');
  stage.replaceChildren(frame);
  frame.focus();
}
function showEditorPick(){
  const heading=document.querySelector('#editors-pick-title');
  returnFocus=heading;
  closeDialog();
  heading.scrollIntoView({block:'center'});
}
function notify(message){const toast=document.querySelector('#toast');toast.textContent=message;toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),2600);}
function toggleSaved(id){
  const r=findRecord(id);if(!r)return;
  saved.has(id)?saved.delete(id):saved.add(id);
  let persisted=true;try{localStorage.setItem(storageKey,JSON.stringify([...saved]));}catch{persisted=false;}
  document.querySelectorAll('.saved-count').forEach(el=>el.textContent=saved.size);
  document.querySelectorAll(`[data-save="${id}"]`).forEach(el=>{el.setAttribute('aria-pressed',String(saved.has(id)));el.setAttribute('aria-label',`${saved.has(id)?'Remove':'Save'} ${r.album}${saved.has(id)?' from saved records':''}`);el.textContent=el.hasAttribute('data-long-label')?(saved.has(id)?'− Saved':'+ Save track'):(saved.has(id)?'−':'+');});
  if(dialogMode==='library'){renderLibrary();dialogContent.querySelector('button')?.focus();}
  notify(`${saved.has(id)?'Saved':'Removed'} ${r.album}${!persisted?' · for this visit':''}`);
}
function resultRow(r){return `<button class="search-result" data-listen="${r.id}">${cover(r)}<span><strong>${r.artist}</strong><small>${r.album} · ${r.year}</small></span><span aria-hidden="true" style="flex:0">↗</span></button>`;}
function renderLibrary(){
  const list=records.filter(r=>saved.has(r.id));
  openDialog(`<p class="eyebrow dialog-eyebrow">YOUR OWN LITTLE LISTENING SHELF</p><h2 id="dialog-title" class="dialog-title">Saved for later.</h2>${list.length?list.map(r=>`<div class="library-row">${resultRow(r)}<button class="save-button" data-save="${r.id}" aria-label="Remove ${r.album} from saved records">Remove</button></div>`).join(''):'<p class="empty-state">Your shelf is waiting. Use the + beside a track to keep it here.</p><button class="underlink" data-close>Back to the music ↗</button>'}<p class="embed-caption">Your saved tracks stay in this browser.</p>`,'library');
}
function renderSearch(){
  openDialog('<p class="eyebrow dialog-eyebrow">FOLLOW YOUR CURIOSITY</p><h2 id="dialog-title" class="dialog-title">What’s your sound?</h2><label class="sr-only" for="search-input">Search artists, records, songs or genres</label><input class="search-input" id="search-input" type="search" placeholder="Try an artist, record or song…" autocomplete="off"><div id="search-results"></div><p class="embed-caption" id="search-status" role="status"></p>','search');
  const input=document.querySelector('#search-input');input.addEventListener('input',()=>updateSearch(input.value));updateSearch('');input.focus();
}
function updateSearch(query){
  const normalize=value=>value.toLocaleLowerCase().replace(/[’‘]/g,"'");
  const q=normalize(query.trim());const matches=records.filter(r=>normalize(`${r.artist} ${r.korean} ${r.aliases||''} ${r.album} ${r.koreanTitle||''} ${r.release||''} ${r.genre} ${r.category}`).includes(q));
  const pickMatches=document.querySelector('#editors-pick').dataset.searchTerms.toLocaleLowerCase().includes(q);
  const pickResult=pickMatches?'<button class="search-result" data-editor-pick><span class="search-video-mark mono" aria-hidden="true">MV</span><span><strong>Yoon Mirae <span lang="ko">윤미래</span></strong><small>Breath (숨) · Editor’s pick · 2025</small></span><span aria-hidden="true" style="flex:0">↗</span></button>':'';
  const count=matches.length+Number(pickMatches);
  document.querySelector('#search-results').innerHTML=count?matches.map(resultRow).join('')+pickResult:'<p class="empty-state">No results found. Try “YdBB”, “Breath” or “한로로”.</p>';
  document.querySelector('#search-status').textContent=`${count} ${count===1?'result':'results'} in this edition.`;
}
const stories={
  "ydbb": {
    "label": "IN FOCUS / YdBB",
    "title": "A farewell worth staying for.",
    "image": "ydbb.jpg",
    "alt": "The five members of YdBB seated in red cinema chairs",
    "body": "<p>YdBB, also known as Yudabinband (유다빈밴드), are a five-piece band formed around singer-songwriter Yu Dabin. Their music spans acoustic folk and rock.</p><p>For this edition, begin with “ONCE”, released in October 2023. In the band’s release interview, Yu Dabin describes a farewell: letting someone go while wishing to be remembered kindly.</p><h3>Look at the cover, too.</h3><p>Yu Dabin made the artwork by drawing over a photograph of her own hand. It is another personal detail to notice as you get to know the band.</p>",
    "record": "ydbb",
    "source": "https://www.genie.co.kr/magazine/subMain?ctid=1&mgz_seq=13700",
    "sourceName": "YdBB — ONCE interview and artwork story"
  },
  "first-listens": {
    "label": "LISTENING GUIDE / FOUR FIRST ENCOUNTERS",
    "title": "One song. Four ways in.",
    "body": "<p>This selection starts with four songs we want more people to hear. Two bands, two solo artists, and a different point of entry with each.</p><h3>01 / YdBB — ONCE</h3><p>Begin with the band’s 2023 single, a song about parting and the wish to be remembered.</p><h3>02 / WhiteUsedSocks — Don’t feel sad</h3><p>Go back to June 2017 for this early single, then follow the band’s official discography from there.</p><h3>03 / Motte — Don’t run away</h3><p>Find a singer-songwriter through a soundtrack: this is Motte’s contribution to A-TEEN Part.4.</p><h3>04 / HANRORO — Even if you leave</h3><p>End with “자처”, a 2023 single about attachment, regret and learning to carry on.</p>",
    "record": "ydbb",
    "source": "https://www.youtube.com/watch?v=vyTiHwIK2LU",
    "sourceName": "Start with ONCE — YdBB - Topic"
  },
  "motte": {
    "label": "FIRST ENCOUNTERS / MOTTE",
    "title": "A song beyond the screen.",
    "image": "motte-dont-run-away.jpg",
    "alt": "A-TEEN Part.4 release artwork",
    "body": "<p>“Don’t run away” (도망가지마) was released in September 2018 as part of the soundtrack to the web drama <em>A-TEEN</em>.</p><p>For listeners who discovered Motte through the series, the song is a familiar starting point. For everyone else, it is an introduction to a Korean singer-songwriter whose music can be explored beyond the screen.</p>",
    "record": "motte",
    "source": "https://music.apple.com/us/album/a-teen-original-soundtrack-pt-4-single/1436476166",
    "sourceName": "Motte — A-TEEN Part.4 release information"
  },
  "hanroro": {
    "label": "LISTENING NOTES / HANRORO",
    "title": "Learning to let go.",
    "image": "hanroro-even-if-you-leave.jpg",
    "alt": "Even if you leave release artwork",
    "body": "<p>HANRORO wrote and composed “자처”, released as <em>Even if you leave,</em> in April 2023.</p><p>In the release notes, she describes the difficulty of separating yourself from what holds you back: a relationship, a choice or your own self-blame. The song looks toward accepting what has gone and moving through one day at a time.</p>",
    "record": "hanroro",
    "source": "https://poclanos.com/album/52690/",
    "sourceName": "HANRORO — release notes and credits on POCLANOS"
  }
};
function openStory(id){const s=stories[id];if(!s)return;openDialog(`<article class="story-body"><p class="eyebrow dialog-eyebrow">${s.label}</p><h2 class="dialog-title" id="dialog-title">${s.title}</h2>${s.image?`<img src="assets/${s.image}" alt="${s.alt}">`:''}${s.body}<button class="room-button" data-listen="${s.record}"><span class="play-triangle" aria-hidden="true"></span> Listen to the track <span aria-hidden="true">↗</span></button><div class="story-source">A listening note from this edition.<br>Release information: <a href="${s.source}" target="_blank" rel="noopener noreferrer">${s.sourceName} ↗</a></div></article>`,'story');}

document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(!dialog.open)dialogTrigger=button;
  if(button.hasAttribute('data-listen'))openRecord(button.dataset.listen);
  else if(button.hasAttribute('data-load-player'))loadPlayer(button.dataset.loadPlayer);
  else if(button.hasAttribute('data-load-video'))loadVideo();
  else if(button.hasAttribute('data-editor-pick'))showEditorPick();
  else if(button.hasAttribute('data-save'))toggleSaved(button.dataset.save);
  else if(button.hasAttribute('data-library'))renderLibrary();
  else if(button.hasAttribute('data-search'))renderSearch();
  else if(button.hasAttribute('data-story'))openStory(button.dataset.story);
  else if(button.hasAttribute('data-close'))closeDialog();
  else if(button.hasAttribute('data-filter')){activeFilter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));renderRecords();}
});
renderRecords();
