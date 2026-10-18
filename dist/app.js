'use strict';

// Replace this small, verified catalogue to create the next editorial edition.
const records = [
  {id:'say-sue-me',artist:'Say Sue Me',korean:'세이수미',album:'The Last Thing Left',year:'2022',genre:'INDIE ROCK',category:'guitar',image:'last-thing-left.jpg',track:'Around You',duration:'03:42',albumId:1447690512,trackId:3074066733,url:'https://saysueme.bandcamp.com/album/the-last-thing-left',note:'Salt-air guitars. A soft place to land.',description:'A warm entry point into the Busan quartet’s world. Recorded and produced in their own studio, this album leaves room for both bright guitar melodies and quieter reflection.'},
  {id:'mid-air-thief',artist:'Mid-Air Thief',korean:'공중도둑',album:'Crumbling',year:'2018',genre:'PSYCHEDELIC FOLK',category:'electronic',image:'crumbling.jpg',track:'These Chains',duration:'05:07',albumId:303635167,trackId:431797831,url:'https://midairthief.bandcamp.com/album/crumbling',note:'Acoustic details. Electronic daydreams.',description:'Acoustic fragments and electronic textures fold into each other on Mid-Air Thief’s second album, with voice and lyrics by Summer Soul. A record that rewards a closer listen.'},
  {id:'parannoul',artist:'Parannoul',korean:'파란노을',album:'After the Magic',year:'2023',genre:'SHOEGAZE',category:'guitar',image:'after-the-magic.jpg',track:'We Shine at Night',duration:'06:27',albumId:754923366,trackId:755431605,url:'https://parannoul.bandcamp.com/album/after-the-magic',note:'Big feelings. An even bigger wall of sound.',description:'An expansive introduction to the Seoul musician’s world: towering layers, open-hearted melodies and moments of startling clarity. Start with “We Shine at Night.”'},
  {id:'jambinai',artist:'Jambinai',korean:'잠비나이',album:'ONDA',year:'2019',genre:'EXPERIMENTAL / POST-ROCK',category:'experimental',image:'onda.jpg',track:'ONDA',duration:'07:08',albumId:228223658,trackId:1090580947,url:'https://jambinai.bandcamp.com/album/onda',note:'Old instruments. Entirely new possibilities.',description:'Korean traditional instruments meet the weight and dynamics of post-rock. On ONDA, Jambinai build a sound that moves from patient tension to full-band force.'}
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
const findRecord=id=>records.find(r=>r.id===id);
const cover=r=>`<img src="assets/${r.image}" alt="${r.album} album artwork" width="350" height="350" loading="lazy">`;
const saveButton=r=>`<button class="save-button" data-save="${r.id}" aria-label="${saved.has(r.id)?'Remove':'Save'} ${r.album}${saved.has(r.id)?' from saved records':''}" aria-pressed="${saved.has(r.id)}">${saved.has(r.id)?'−':'+'}</button>`;

function renderRecords(){
  document.querySelector('#record-grid').innerHTML=records.map(r=>`<article class="record-card" data-category="${r.category}" ${activeFilter!=='all'&&activeFilter!==r.category?'hidden':''}><div class="record-cover"><button class="cover-button" data-listen="${r.id}" aria-label="Listen to ${r.album} by ${r.artist}">${cover(r)}<span class="cover-listen">OPEN RECORD <span aria-hidden="true">↗</span></span></button></div><div class="record-meta mono"><span>${r.genre} · ${r.year}</span>${saveButton(r)}</div><h3><button data-listen="${r.id}">${r.album}</button></h3><p class="record-artist">${r.artist}</p><p class="record-note">${r.note}</p></article>`).join('');
  const count=records.filter(r=>activeFilter==='all'||r.category===activeFilter).length;
  document.querySelector('#record-count').textContent=`${String(count).padStart(2,'0')} ${count===1?'RECORD':'RECORDS'}`;
  document.querySelectorAll('.saved-count').forEach(el=>el.textContent=saved.size);
}
document.querySelector('#track-list').innerHTML=[records[1],records[0],records[2],records[3]].map((r,i)=>`<button class="track" data-listen="${r.id}" aria-label="Listen to ${r.track} by ${r.artist}"><span class="track-number">0${i+1}</span>${cover(r)}<span class="track-info"><strong>${r.track}</strong><span>${r.artist}</span></span><span class="track-time">${r.duration}</span><span class="track-play" aria-hidden="true">▷</span></button>`).join('');

function openDialog(content,mode){
  const wasOpen=dialog.open;
  if(!wasOpen)returnFocus=document.activeElement;
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
  openDialog(`<div class="album-detail">${cover(r)}<div><p class="eyebrow dialog-eyebrow">${r.genre} / ${r.year}</p><h2 id="dialog-title" class="dialog-title">${r.album}</h2><p>${r.artist} <span lang="ko">${r.korean}</span></p><div class="detail-actions"><a class="underlink" href="${r.url}" target="_blank" rel="noopener noreferrer">Visit the artist on Bandcamp ↗</a><button class="save-button" data-save="${r.id}" data-long-label aria-pressed="${saved.has(r.id)}">${saved.has(r.id)?'− Saved':'+ Save record'}</button></div></div></div><p style="margin-top:24px;color:var(--muted);font-size:14px;line-height:1.8">${r.description}</p><div class="embed-shell"><div class="player-prompt"><p>Start with “${r.track}”. Load the artist’s official Bandcamp player to listen here.</p><button class="room-button" data-load-player="${r.id}"><span class="play-triangle" aria-hidden="true"></span> Load Bandcamp player <span aria-hidden="true">↗</span></button></div></div><p class="embed-caption">Music plays only when you press play. If the player is unavailable, <a href="${r.url}" target="_blank" rel="noopener noreferrer">listen directly on Bandcamp ↗</a>.</p>`,'record');
}
function loadPlayer(id){
  const r=findRecord(id);if(!r)return;
  const shell=dialogContent.querySelector('.embed-shell');
  const frame=document.createElement('iframe');
  frame.title=`Bandcamp player: ${r.track} by ${r.artist}`;
  frame.src=`https://bandcamp.com/EmbeddedPlayer/album=${r.albumId}/size=large/bgcol=f5f3ed/linkcol=c83b26/tracklist=false/artwork=none/track=${r.trackId}/transparent=true/`;
  frame.allow='encrypted-media';frame.referrerPolicy='strict-origin-when-cross-origin';
  shell.replaceChildren(frame);
}
function notify(message){const toast=document.querySelector('#toast');toast.textContent=message;toast.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('visible'),2600);}
function toggleSaved(id){
  const r=findRecord(id);if(!r)return;
  saved.has(id)?saved.delete(id):saved.add(id);
  let persisted=true;try{localStorage.setItem(storageKey,JSON.stringify([...saved]));}catch{persisted=false;}
  document.querySelectorAll('.saved-count').forEach(el=>el.textContent=saved.size);
  document.querySelectorAll(`[data-save="${id}"]`).forEach(el=>{el.setAttribute('aria-pressed',String(saved.has(id)));el.setAttribute('aria-label',`${saved.has(id)?'Remove':'Save'} ${r.album}${saved.has(id)?' from saved records':''}`);el.textContent=el.hasAttribute('data-long-label')?(saved.has(id)?'− Saved':'+ Save record'):(saved.has(id)?'−':'+');});
  if(dialogMode==='library'){renderLibrary();dialogContent.querySelector('button')?.focus();}
  notify(`${saved.has(id)?'Saved':'Removed'} ${r.album}${!persisted?' · for this visit':''}`);
}
function resultRow(r){return `<button class="search-result" data-listen="${r.id}">${cover(r)}<span><strong>${r.artist}</strong><small>${r.album} · ${r.year}</small></span><span aria-hidden="true" style="flex:0">↗</span></button>`;}
function renderLibrary(){
  const list=records.filter(r=>saved.has(r.id));
  openDialog(`<p class="eyebrow dialog-eyebrow">YOUR OWN LITTLE RECORD SHELF</p><h2 id="dialog-title" class="dialog-title">Saved for later.</h2>${list.length?list.map(r=>`<div class="library-row">${resultRow(r)}<button class="save-button" data-save="${r.id}" aria-label="Remove ${r.album} from saved records">Remove</button></div>`).join(''):'<p class="empty-state">Your shelf is waiting. Use the + beside a record to keep it here.</p><button class="underlink" data-close>Back to the music ↗</button>'}<p class="embed-caption">Your saved records stay in this browser.</p>`,'library');
}
function renderSearch(){
  openDialog('<p class="eyebrow dialog-eyebrow">FOLLOW YOUR CURIOSITY</p><h2 id="dialog-title" class="dialog-title">What’s your sound?</h2><label class="sr-only" for="search-input">Search artists, records or genres</label><input class="search-input" id="search-input" type="search" placeholder="Try an artist, album or sound…" autocomplete="off"><div id="search-results"></div><p class="embed-caption" id="search-status" role="status"></p>','search');
  const input=document.querySelector('#search-input');input.addEventListener('input',()=>updateSearch(input.value));updateSearch('');input.focus();
}
function updateSearch(query){
  const q=query.trim().toLocaleLowerCase();const matches=records.filter(r=>`${r.artist} ${r.korean} ${r.album} ${r.genre} ${r.category}`.toLocaleLowerCase().includes(q));
  document.querySelector('#search-results').innerHTML=matches.length?matches.map(resultRow).join(''):'<p class="empty-state">No records found. Try “guitar”, “Parannoul” or “공중도둑”.</p>';
  document.querySelector('#search-status').textContent=`${matches.length} ${matches.length===1?'record':'records'} in this edition.`;
}
const stories={
  'say-sue-me':{label:'IN FOCUS / BUSAN, SOUTH KOREA',title:'A little closer to the coast.',image:'say-sue-me.jpg',alt:'Say Sue Me photographed outdoors in black and white',body:'<p>Say Sue Me are an indie rock band from Busan. For a first encounter, try <em>The Last Thing Left</em>: their 2022 album, recorded and produced in the band’s own studio.</p><p>The appeal is in the balance. Bright, ringing guitars leave space for a more reflective mood. Our suggested starting point is “Around You” — then stay for the rest of the record.</p><h3>Start with a song. Stay for an album.</h3><p>You do not need a map of the entire scene to find a way in. Listen to one track, notice what catches your ear, and let that be enough for a beginning.</p>',record:'say-sue-me',source:'https://saysueme.bandcamp.com/album/the-last-thing-left',sourceName:'Say Sue Me — official album page'},
  busan:{label:'FIELD NOTES / A FIRST LISTEN',title:'Start at the coast. See where it takes you.',body:'<p>Begin with Say Sue Me, an indie rock band from Busan. Their album <em>The Last Thing Left</em> was made in their own studio — a useful reminder that Korean independent music reaches well beyond a single city or a single sound.</p><h3>01 / Let the guitars lead.</h3><p>Put on “Around You”. If its bright melodies pull you in, listen through the album before reaching for another recommendation.</p><h3>02 / Take a different turn.</h3><p>For something more densely layered, try Parannoul’s <em>After the Magic</em>. For a different kind of intricacy, move to the acoustic and electronic textures of Mid-Air Thief’s <em>Crumbling</em>.</p><h3>03 / Keep the artist close.</h3><p>The links on this shelf lead to official artist pages. Read the credits, explore the catalogue and support a record if it stays with you.</p>',record:'say-sue-me',source:'https://saysueme.bandcamp.com/album/the-last-thing-left',sourceName:'Say Sue Me — official album page'},
  crumbling:{label:'LISTENING NOTES / MID-AIR THIEF',title:'A whole world between the headphones.',image:'crumbling.jpg',alt:'Crumbling album artwork by Shin Hyejeong',body:'<p>Released in 2018, <em>Crumbling</em> is Mid-Air Thief’s second album. Summer Soul contributes voice and lyrics; the album artwork is credited to Shin Hyejeong.</p><p>Listen for the way acoustic fragments and electronic sounds trade places. Instead of settling into one texture, the arrangements keep opening small doors into the next.</p><h3>Your first track: “These Chains”.</h3><p>Give it your full attention once. On a second listen, follow a different layer. That is the pleasure of a record with this much detail: your point of entry can change.</p>',record:'mid-air-thief',source:'https://midairthief.bandcamp.com/album/crumbling',sourceName:'Mid-Air Thief — official album page'},
  jambinai:{label:'FIRST ENCOUNTERS / JAMBINAI',title:'Tradition, turned all the way up.',image:'onda.jpg',alt:'ONDA album artwork',body:'<p>Jambinai bring Korean instruments into a band setting that draws on post-rock and experimental music. The 2019 album <em>ONDA</em> is a powerful place to begin.</p><p>The music makes room for contrast: patient passages, rough textures and a much larger collective force. Traditional instrumentation is part of the musical language, woven into the full band.</p><h3>Start with the title track.</h3><p>Let “ONDA” unfold at its own pace. Then return to the opening track, “Sawtooth”, and hear how the record builds its world from the beginning.</p>',record:'jambinai',source:'https://jambinai.bandcamp.com/album/onda',sourceName:'Jambinai — official album page'}
};
function openStory(id){const s=stories[id];if(!s)return;openDialog(`<article class="story-body"><p class="eyebrow dialog-eyebrow">${s.label}</p><h2 class="dialog-title" id="dialog-title">${s.title}</h2>${s.image?`<img src="assets/${s.image}" alt="${s.alt}">`:''}${s.body}<button class="room-button" data-listen="${s.record}"><span class="play-triangle" aria-hidden="true"></span> Listen to the record <span aria-hidden="true">↗</span></button><div class="story-source">An introductory listening note for this design edition.<br>Release information: <a href="${s.source}" target="_blank" rel="noopener noreferrer">${s.sourceName} ↗</a></div></article>`,'story');}

document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-listen'))openRecord(button.dataset.listen);
  else if(button.hasAttribute('data-load-player'))loadPlayer(button.dataset.loadPlayer);
  else if(button.hasAttribute('data-save'))toggleSaved(button.dataset.save);
  else if(button.hasAttribute('data-library'))renderLibrary();
  else if(button.hasAttribute('data-search'))renderSearch();
  else if(button.hasAttribute('data-story'))openStory(button.dataset.story);
  else if(button.hasAttribute('data-close'))closeDialog();
  else if(button.hasAttribute('data-filter')){activeFilter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));renderRecords();}
});
renderRecords();
