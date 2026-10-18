'use strict';

// Replace this small, verified catalogue to create the next editorial edition.
const records = [
  {
    "id": "black-skirts",
    "artist": "The Black Skirts",
    "korean": "검정치마",
    "aliases": "Jo Hyu-il Bryan Cho 조휴일",
    "album": "EVERYTHING",
    "release": "TEAM BABY",
    "releaseYear": "2017",
    "year": "2016",
    "genre": "INDIE ROCK",
    "category": "solo",
    "image": "black-skirts.jpg",
    "track": "EVERYTHING",
    "koreanTitle": "",
    "duration": "05:04",
    "provider": "youtube",
    "videoId": "Aq_gsctWHtQ",
    "channel": "SEOUL MUSIC / 서울뮤직",
    "url": "https://www.youtube.com/watch?v=Aq_gsctWHtQ",
    "videoType": "music-video",
    "performance": "Official music video · SEOUL MUSIC",
    "note": "A love song from TEAM BABY.",
    "description": "First released as a single in 2016, “EVERYTHING” later appeared on the 2017 album TEAM BABY. Begin with the official music video, then follow the album into the rest of Bryan Cho’s songwriting.",
    "source": "https://music.apple.com/us/album/team-baby/1242154383",
    "sourceName": "The Black Skirts — TEAM BABY on Apple Music",
    "artistIntro": "The Black Skirts is the solo project of singer-songwriter Bryan Cho, also known as Jo Hyu-il. Born in Seoul and raised in New Jersey, he makes music that moves between indie pop and rock.",
    "artistSource": "https://prtimes.jp/main/html/rd/p/000000433.000055377.html",
    "artistSourceName": "The Orchard Japan"
  },
  {
    "id": "sunwoojunga",
    "artist": "sunwoojunga",
    "korean": "선우정아",
    "aliases": "SWJA Sunwoo Jung-a Sunwoo Junga",
    "album": "Run with Me",
    "release": "Serenade",
    "year": "2019",
    "genre": "POP / JAZZ",
    "category": "solo",
    "image": "sunwoojunga.jpg",
    "track": "Run with Me",
    "koreanTitle": "도망가자",
    "duration": "04:54",
    "provider": "youtube",
    "videoId": "fNrhdZwhj-c",
    "channel": "선우정아 / sunwoojunga",
    "url": "https://www.youtube.com/watch?v=fNrhdZwhj-c",
    "videoType": "live",
    "performance": "SERENADE concert · Sogang University Mary Hall · 2019",
    "note": "From her 2019 SERENADE concert.",
    "description": "“Run with Me” appears on sunwoojunga’s 2019 album Serenade. This performance, shared on her own channel, was recorded at her SERENADE concert at Sogang University’s Mary Hall.",
    "source": "https://music.apple.com/us/album/serenade/1491118222",
    "sourceName": "sunwoojunga — Serenade on Apple Music",
    "artistIntro": "sunwoojunga is a singer, songwriter and producer whose work moves between pop and jazz. She was named Musician of the Year at the 2014 Korean Music Awards.",
    "artistSource": "https://koreanmusicawards.com/project/%EC%84%A0%EC%9A%B0%EC%A0%95%EC%95%84/",
    "artistSourceName": "Korean Music Awards"
  },
  {
    "id": "car-the-garden",
    "artist": "Car, the garden",
    "korean": "카더가든",
    "aliases": "Car the Garden Mayson the Soul 메이슨 더 소울 차정원",
    "album": "Tree",
    "release": "Tree - Single",
    "year": "2019",
    "genre": "BALLAD",
    "category": "solo",
    "image": "car-the-garden.jpg",
    "track": "Tree",
    "koreanTitle": "나무",
    "duration": "03:43",
    "provider": "youtube",
    "videoId": "6e_H3ngjD7A",
    "channel": "KBS Kpop",
    "url": "https://www.youtube.com/watch?v=6e_H3ngjD7A",
    "videoType": "live",
    "performance": "The Seasons — Choi Jung-hoon’s Night Park · KBS, 2023",
    "note": "A live performance from The Seasons.",
    "description": "Released as a single in April 2019, “Tree” is an inviting place to meet Car, the garden. This live performance aired on The Seasons — Choi Jung-hoon’s Night Park on June 16, 2023, and is shared by KBS Kpop.",
    "source": "https://music.apple.com/us/album/tree-single/1459990039",
    "sourceName": "Car, the garden — Tree on Apple Music",
    "artistIntro": "Car, the garden is the singer-songwriter formerly known as Mayson the Soul. His music draws on rock, pop and R&B; his stage name is a playful translation of his Korean name, Cha Jung-won.",
    "artistSource": "https://www.cjazit.org/support/tune-up/selection/1561",
    "artistSourceName": "CJ Cultural Foundation — Car, the garden",
    "externalOnly": true
  },
  {
    "id": "choi-yu-ree",
    "artist": "Choi Yu Ree",
    "korean": "최유리",
    "aliases": "Choi Yuree Choi Yu-ri Choi Yuri",
    "album": "Forest",
    "release": "Stroll - Single",
    "year": "2022",
    "genre": "FOLK",
    "category": "solo",
    "image": "choi-yu-ree.jpg",
    "track": "Forest",
    "koreanTitle": "숲",
    "duration": "03:52",
    "provider": "youtube",
    "videoId": "AOGhUcAdTKk",
    "channel": "SUPER SOUND Bugs!",
    "url": "https://www.youtube.com/watch?v=AOGhUcAdTKk",
    "videoType": "live",
    "performance": "Bugs-ker live session",
    "note": "A song about finding a place among others.",
    "description": "“Forest” turns the feeling of being small among others into an image of trees growing together. Choi Yu Ree wrote and composed the song for her 2022 single release Stroll. Here, it is heard in an official Bugs-ker live session.",
    "source": "https://music.apple.com/us/album/stroll-single/1641252974",
    "sourceName": "Choi Yu Ree — Stroll on Apple Music",
    "artistIntro": "Choi Yu Ree is a folk singer-songwriter whose warm, reflective songs begin with everyday feelings. A grand-prize winner at the 29th Yoo Jae-ha Music Contest, she made her official debut with the EP Shape in 2020.",
    "artistSource": "https://www.cjazit.org/support/tune-up/entry/50/24481",
    "artistSourceName": "CJ Cultural Foundation — Choi Yu Ree"
  },
  {
    "id": "bol4",
    "artist": "BOL4",
    "korean": "볼빨간사춘기",
    "aliases": "Bolbbalgan4 Ahn Ji-young 안지영 Eternal Love",
    "album": "Eternal love",
    "release": "Merry Go Round - EP",
    "year": "2023",
    "genre": "POP",
    "category": "solo",
    "image": "bol4.jpg",
    "track": "Eternal love",
    "koreanTitle": "사랑할 수밖에",
    "duration": "03:50",
    "provider": "youtube",
    "videoId": "Gw00jZ0RA-E",
    "channel": "볼빨간사춘기 BOL4",
    "url": "https://www.youtube.com/watch?v=Gw00jZ0RA-E",
    "videoType": "live",
    "performance": "2024 BOL4 Concert “Bloom”",
    "note": "On stage at the 2024 Bloom concert.",
    "description": "Originally released on the 2023 EP Merry Go Round, “Eternal love” is introduced here through BOL4’s own live clip from the 2024 Bloom concert. Ahn Ji-young’s voice stays at the centre, making this a direct introduction to her songwriting and stage presence.",
    "source": "https://music.apple.com/us/album/merry-go-round-ep/1720724415",
    "sourceName": "BOL4 — Merry Go Round - EP on Apple Music",
    "artistIntro": "BOL4 is singer-songwriter Ahn Ji-young’s pop project. Her songs explore the candid feelings of youth, from the excitement of a new relationship to the ache of growing apart.",
    "artistSource": "https://bol4.jp/profiles",
    "artistSourceName": "BOL4 — official profile"
  },
  {
    "id": "esegye",
    "artist": "ESEGYE",
    "korean": "이세계",
    "aliases": "Isegye Romance Youth Love 낭만 젊음 사랑",
    "album": "RomanceYouthLove",
    "release": "Cry For Me / RomanceYouthLove - Single",
    "year": "2020",
    "genre": "INDIE ROCK",
    "category": "bands",
    "image": "esegye.jpg",
    "track": "RomanceYouthLove",
    "koreanTitle": "낭만젊음사랑",
    "duration": "04:50",
    "provider": "youtube",
    "videoId": "rly_h23jX3M",
    "channel": "이세계ESEGYE",
    "url": "https://www.youtube.com/watch?v=rly_h23jX3M",
    "videoType": "live",
    "performance": "BLIND concert · Veloso Hongdae",
    "note": "From the band’s first BLIND concert.",
    "description": "“RomanceYouthLove” appeared on ESEGYE’s debut double single in June 2020. This performance comes from the band’s first BLIND concert at Veloso Hongdae, shared on their own channel. It is a close-up introduction to a group whose songs make room for feelings that are difficult to say aloud.",
    "source": "https://music.apple.com/us/album/cry-for-me-romanceyouthlove-single/1518190054",
    "sourceName": "ESEGYE — Cry For Me / RomanceYouthLove - Single on Apple Music",
    "artistIntro": "ESEGYE is a Korean band whose name points to another world. They began releasing music in 2020, writing about the deep feelings people often keep to themselves.",
    "artistSource": "https://poclanos.com/featured/newbies-1/",
    "artistSourceName": "POCLANOS — introducing ESEGYE"
  },
  {
    "id": "se-so-neon",
    "artist": "SE SO NEON",
    "korean": "새소년",
    "aliases": "SeSoNeon Soyoon Hwang So!YoON! 황소윤 파도",
    "album": "The Wave",
    "release": "Summer Plumage - EP",
    "year": "2017",
    "genre": "PSYCHEDELIC ROCK",
    "category": "bands",
    "image": "se-so-neon.jpg",
    "track": "The Wave",
    "koreanTitle": "파도",
    "duration": "04:50",
    "provider": "youtube",
    "videoId": "SPGuXMzKpvQ",
    "channel": "새소년 SE SO NEON",
    "url": "https://www.youtube.com/watch?v=SPGuXMzKpvQ",
    "videoType": "live",
    "performance": "2020/NEON · YES24 Live Hall, 2019",
    "note": "A 2017 song, heard live at 2020/NEON.",
    "description": "First released as a single in September 2017 and included on Summer Plumage that October, “The Wave” won Best Rock Song at the 2018 Korean Music Awards. This official live version was filmed at the 2020/NEON concert on December 7, 2019, at YES24 Live Hall. Let it run through the extended instrumental finish.",
    "source": "https://music.apple.com/us/album/summer-plumage-ep/1450484183",
    "sourceName": "SE SO NEON — Summer Plumage - EP on Apple Music",
    "artistIntro": "SE SO NEON’s music combines blues, psychedelic rock and pop, led by Hwang Soyoon’s voice and guitar. The act won Rookie of the Year at the 2018 Korean Music Awards.",
    "artistSource": "https://koreanmusicawards.com/project/%EC%83%88%EC%86%8C%EB%85%84/",
    "artistSourceName": "Korean Music Awards — SE SO NEON"
  },
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
    "source": "https://music.apple.com/us/album/once-single/1713690764",
    "sourceName": "YdBB — ONCE on Apple Music",
    "artistIntro": "YdBB are a five-piece Korean band formed around singer-songwriter Yu Dabin. Their music moves between acoustic folk and rock, with songs about the people and feelings we carry with us.",
    "artistSource": "https://mpmgmusic.com/yudabinband",
    "artistSourceName": "YdBB — MPMG MUSIC artist profile"
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
    "source": "https://music.apple.com/us/album/dont-feel-sad-single/1732022836",
    "sourceName": "WhiteUsedSocks — Don’t feel sad on Apple Music",
    "artistIntro": "WhiteUsedSocks are a Korean rock band who began releasing music in 2017. Expressive vocals and emotional lyrics sit at the heart of their songs, including the early single “Don’t feel sad”.",
    "artistSource": "https://poclanos.com/artist/whiteusedsocks/",
    "artistSourceName": "WhiteUsedSocks — POCLANOS artist profile"
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
    "sourceName": "Motte — A-TEEN Part.4 on Apple Music",
    "artistIntro": "Motte is a Korean singer-songwriter who debuted with “Tickin’” in 2017. Her songs draw on uncertain relationships and memories, while “Don’t run away” introduced her voice to viewers of A-TEEN.",
    "artistSource": "https://www.genie.co.kr/magazine/subMain?ctid=1&mgz_seq=6926",
    "artistSourceName": "Motte — Genie artist introduction"
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
    "source": "https://music.apple.com/us/album/even-if-you-leave-single/1683092568",
    "sourceName": "HANRORO — Even if you leave on Apple Music",
    "artistIntro": "HANRORO is a Korean singer-songwriter who debuted in 2022 with “Let Me Love My Youth” (입춘). Her rock songs give voice to the fears and hopes of growing up, reaching out to others facing the same uncertainty.",
    "artistSource": "https://koreanmusicawards.com/project/%ED%95%9C%EB%A1%9C%EB%A1%9C/",
    "artistSourceName": "HANRORO — Korean Music Awards artist profile"
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
const titleMarkup=title=>title.replace(/([a-z])([A-Z])/g,'$1<wbr>$2');
const videoLabel=r=>r.videoType==='live'?'LIVE PERFORMANCE':r.videoType==='music-video'?'OFFICIAL MUSIC VIDEO':'';

function renderRecords(){
  document.querySelector('#record-grid').innerHTML=records.map(r=>`<article class="record-card" data-category="${r.category}" ${activeFilter!=='all'&&activeFilter!==r.category?'hidden':''}><div class="record-cover"><button class="cover-button" data-listen="${r.id}" aria-label="Listen to ${r.album} by ${r.artist}">${cover(r)}<span class="cover-listen">OPEN TRACK <span aria-hidden="true">↗</span></span></button></div><div class="record-meta mono"><span>${r.genre} · ${r.year}</span>${saveButton(r)}</div><h3><button data-listen="${r.id}">${titleMarkup(r.album)}</button></h3><p class="record-artist">${r.artist}</p>${r.videoType?`<p class="record-format mono">${videoLabel(r)}</p>`:''}<p class="record-note">${r.note}</p><p class="record-intro">${r.artistIntro}</p><button class="underlink record-profile-link" data-story="${r.id}" aria-label="Read about ${r.artist}">Meet the artist <span aria-hidden="true">↗</span></button></article>`).join('');
  const count=records.filter(r=>activeFilter==='all'||r.category===activeFilter).length;
  document.querySelector('#record-count').textContent=`${String(count).padStart(2,'0')} ${count===1?'TRACK':'TRACKS'}`;
  document.querySelectorAll('.saved-count').forEach(el=>el.textContent=saved.size);
}
document.querySelector('[data-filter="all"] sup').textContent=String(records.length).padStart(2,'0');
// Four starting points stay beside the portraits as the main shelf grows.
const roomRecords=['ydbb','whiteusedsocks','motte','hanroro'].map(findRecord);
document.querySelector('#track-list').innerHTML=roomRecords.map((r,i)=>`<button class="track" data-listen="${r.id}" aria-label="Listen to ${r.track} by ${r.artist}"><span class="track-number">0${i+1}</span>${cover(r)}<span class="track-info"><strong>${r.track}</strong><span>${r.artist}</span></span><span class="track-time">${r.duration}</span><span class="track-play" aria-hidden="true">▷</span></button>`).join('');

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
  const watchLabel=r.videoType==='live'?'Watch live on YouTube':r.videoType==='music-video'?'Watch on YouTube':'Listen on YouTube';
  const playerAction=r.externalOnly?`<a class="room-button" href="${r.url}" target="_blank" rel="noopener noreferrer">Watch live on YouTube <span aria-hidden="true">↗</span></a>`:`<button class="room-button" data-load-player="${r.id}"><span class="play-triangle" aria-hidden="true"></span> Load ${platform} player <span aria-hidden="true">↗</span></button>`;
  const performance=r.videoType?`<p class="performance-heading mono">${videoLabel(r)} · ${r.duration}</p><p>${r.performance}</p>`:'';
  openDialog(`
    <div class="album-detail">${cover(r)}<div>
      <p class="eyebrow dialog-eyebrow">${r.genre} / ${r.year}</p>
      <h2 id="dialog-title" class="dialog-title">${titleMarkup(r.track)}${r.koreanTitle?` <span class="track-korean" lang="ko">${r.koreanTitle}</span>`:''}</h2>
      <p>${r.artist} <span lang="ko">${r.korean}</span></p>
      <div class="detail-actions"><a class="underlink" href="${r.url}" target="_blank" rel="noopener noreferrer">${r.provider==='youtube'?watchLabel:'Visit the artist on Bandcamp'} ↗</a><button class="save-button" data-save="${r.id}" data-long-label aria-pressed="${saved.has(r.id)}">${saved.has(r.id)?'− Saved':'+ Save track'}</button></div>
    </div></div>
    <p class="track-description">${r.description}</p>
    <section class="track-artist-intro" aria-label="About ${r.artist}"><p class="eyebrow">ABOUT THE ARTIST</p><p>${r.artistIntro}</p><button class="underlink" data-story="${r.id}">Meet ${r.artist} <span aria-hidden="true">↗</span></button></section>
    <div class="embed-shell ${r.provider==='youtube'?'youtube-shell':''}"><div class="player-prompt">${performance}<p>${r.videoType?'Watch':'Listen to'} “${r.track}” via ${r.provider==='youtube'?r.channel:'the artist’s official Bandcamp player'}.</p>${playerAction}</div></div>
    ${r.externalOnly?'<p class="embed-caption">This performance opens on YouTube.</p>':`<p class="embed-caption">Music plays only when you press play. If the player is unavailable, <a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.videoType?'watch':'listen'} directly on ${platform} ↗</a>.</p>`}
    <p class="embed-caption">Release information: <a href="${r.source}" target="_blank" rel="noopener noreferrer">${r.sourceName} ↗</a>${r.releaseYear?` · Album released ${r.releaseYear}`:''}</p>`,'record');
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
  const r=findRecord(id);if(!r||r.externalOnly)return;
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
    "body": "<p>For this edition, begin with “ONCE”, released in October 2023. In the band’s release interview, Yu Dabin describes a farewell: letting someone go while wishing to be remembered kindly.</p><h3>Look at the cover, too.</h3><p>Yu Dabin made the artwork by drawing over a photograph of her own hand. It is another personal detail to notice as you get to know the band.</p>",
    "record": "ydbb",
    "source": "https://www.genie.co.kr/magazine/subMain?ctid=1&mgz_seq=13700",
    "sourceName": "YdBB — ONCE interview and artwork story",
    "artistProfile": true
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
    "sourceName": "Motte — A-TEEN Part.4 release information",
    "artistProfile": true
  },
  "hanroro": {
    "label": "LISTENING NOTES / HANRORO",
    "title": "Learning to let go.",
    "image": "hanroro-even-if-you-leave.jpg",
    "alt": "Even if you leave release artwork",
    "body": "<p>HANRORO wrote and composed “자처”, released as <em>Even if you leave,</em> in April 2023.</p><p>In the release notes, she describes the difficulty of separating yourself from what holds you back: a relationship, a choice or your own self-blame. The song looks toward accepting what has gone and moving through one day at a time.</p>",
    "record": "hanroro",
    "source": "https://poclanos.com/album/52690/",
    "sourceName": "HANRORO — release notes and credits on POCLANOS",
    "artistProfile": true
  },
  "whiteusedsocks": {
    "label": "MEET THE ARTIST / WHITEUSEDSOCKS",
    "title": "Start with WhiteUsedSocks.",
    "image": "whiteusedsocks-dont-feel-sad.jpg",
    "alt": "Don’t feel sad release artwork",
    "artistProfile": true,
    "body": "<p>Begin with “Don’t feel sad”, released in June 2017. Written and composed by Jung Jaeheon, it is one of the band’s earliest releases.</p><p>From here, their discography continues through releases including <em>The Little Match Boy</em> and <em>Through Yearning</em>. This edition starts at the beginning, with the song selected for our listening shelf.</p>",
    "record": "whiteusedsocks",
    "source": "https://whiteusedsocks.com/don%27t-feel-sad",
    "sourceName": "WhiteUsedSocks — official release page"
  },
  "black-skirts": {
    "label": "MEET THE ARTIST / THE BLACK SKIRTS",
    "title": "Meet The Black Skirts.",
    "image": "black-skirts.jpg",
    "alt": "TEAM BABY release artwork",
    "artistProfile": true,
    "body": "<h3>Start with “EVERYTHING”.</h3><p>First released as a single in 2016, “EVERYTHING” later appeared on the 2017 album TEAM BABY. Begin with the official music video, then follow the album into the rest of Bryan Cho’s songwriting.</p>",
    "record": "black-skirts",
    "source": "https://www.youtube.com/watch?v=Aq_gsctWHtQ",
    "sourceName": "SEOUL MUSIC / 서울뮤직 — EVERYTHING"
  },
  "sunwoojunga": {
    "label": "MEET THE ARTIST / SUNWOOJUNGA",
    "title": "Meet sunwoojunga.",
    "image": "sunwoojunga.jpg",
    "alt": "Serenade release artwork",
    "artistProfile": true,
    "body": "<h3>Start with “Run with Me”.</h3><p>“Run with Me” appears on sunwoojunga’s 2019 album Serenade. This performance, shared on her own channel, was recorded at her SERENADE concert at Sogang University’s Mary Hall.</p>",
    "record": "sunwoojunga",
    "source": "https://www.youtube.com/watch?v=fNrhdZwhj-c",
    "sourceName": "선우정아 / sunwoojunga — Run with Me"
  },
  "car-the-garden": {
    "label": "MEET THE ARTIST / CAR, THE GARDEN",
    "title": "Meet Car, the garden.",
    "image": "car-the-garden.jpg",
    "alt": "Tree - Single release artwork",
    "artistProfile": true,
    "body": "<h3>Start with “Tree”.</h3><p>Released as a single in April 2019, “Tree” is an inviting place to meet Car, the garden. This live performance aired on The Seasons — Choi Jung-hoon’s Night Park on June 16, 2023, and is shared by KBS Kpop.</p>",
    "record": "car-the-garden",
    "source": "https://www.youtube.com/watch?v=6e_H3ngjD7A",
    "sourceName": "KBS Kpop — Tree on The Seasons"
  },
  "choi-yu-ree": {
    "label": "MEET THE ARTIST / CHOI YU REE",
    "title": "Meet Choi Yu Ree.",
    "image": "choi-yu-ree.jpg",
    "alt": "Stroll - Single release artwork",
    "artistProfile": true,
    "body": "<h3>Start with “Forest”.</h3><p>“Forest” turns the feeling of being small among others into an image of trees growing together. Choi Yu Ree wrote and composed the song for her 2022 single release Stroll. Here, it is heard in an official Bugs-ker live session.</p>",
    "record": "choi-yu-ree",
    "source": "https://music.bugs.co.kr/album/4079006",
    "sourceName": "Bugs — Stroll release notes and credits"
  },
  "bol4": {
    "label": "MEET THE ARTIST / BOL4",
    "title": "Meet BOL4.",
    "image": "bol4.jpg",
    "alt": "Merry Go Round - EP release artwork",
    "artistProfile": true,
    "body": "<h3>Start with “Eternal love”.</h3><p>Originally released on the 2023 EP Merry Go Round, “Eternal love” is introduced here through BOL4’s own live clip from the 2024 Bloom concert. Ahn Ji-young’s voice stays at the centre, making this a direct introduction to her songwriting and stage presence.</p>",
    "record": "bol4",
    "source": "https://www.youtube.com/watch?v=Gw00jZ0RA-E",
    "sourceName": "볼빨간사춘기 BOL4 — Eternal love"
  },
  "esegye": {
    "label": "MEET THE ARTIST / ESEGYE",
    "title": "Meet ESEGYE.",
    "image": "esegye.jpg",
    "alt": "Cry For Me / RomanceYouthLove - Single release artwork",
    "artistProfile": true,
    "body": "<h3>Start with “RomanceYouthLove”.</h3><p>“RomanceYouthLove” appeared on ESEGYE’s debut double single in June 2020. This performance comes from the band’s first BLIND concert at Veloso Hongdae, shared on their own channel. It is a close-up introduction to a group whose songs make room for feelings that are difficult to say aloud.</p>",
    "record": "esegye",
    "source": "https://www.youtube.com/watch?v=rly_h23jX3M",
    "sourceName": "이세계ESEGYE — RomanceYouthLove"
  },
  "se-so-neon": {
    "label": "MEET THE ARTIST / SE SO NEON",
    "title": "Meet SE SO NEON.",
    "image": "se-so-neon.jpg",
    "alt": "Summer Plumage - EP release artwork",
    "artistProfile": true,
    "body": "<h3>Start with “The Wave”.</h3><p>First released as a single in September 2017 and included on Summer Plumage that October, “The Wave” won Best Rock Song at the 2018 Korean Music Awards. This official live version was filmed at the 2020/NEON concert on December 7, 2019, at YES24 Live Hall. Let it run through the extended instrumental finish.</p>",
    "record": "se-so-neon",
    "source": "https://koreanmusicawards.com/project/%EC%83%88%EC%86%8C%EB%85%84-%ED%8C%8C%EB%8F%84/",
    "sourceName": "Korean Music Awards — The Wave"
  }
};
function openStory(id){
  const s=stories[id];if(!s)return;
  const r=findRecord(s.record);
  const intro=s.artistProfile?`<p class="story-artist-intro">${r.artistIntro}</p>`:'';
  const artistSource=s.artistProfile?`<br>Artist background: <a href="${r.artistSource}" target="_blank" rel="noopener noreferrer">${r.artistSourceName} ↗</a>`:'';
  const storySource=s.artistProfile&&s.source!==r.source?`<br>Story source: <a href="${s.source}" target="_blank" rel="noopener noreferrer">${s.sourceName} ↗</a>`:'';
  openDialog(`<article class="story-body"><p class="eyebrow dialog-eyebrow">${s.label}</p><h2 class="dialog-title" id="dialog-title">${s.title}</h2>${intro}${s.image?`<img src="assets/${s.image}" alt="${s.alt}"${s.image===r.image?' class="story-cover"':''}>`:''}${s.body}<button class="room-button" data-listen="${s.record}"><span class="play-triangle" aria-hidden="true"></span> Listen to the track <span aria-hidden="true">↗</span></button><div class="story-source">A listening note from this edition.<br>Release information: <a href="${r.source}" target="_blank" rel="noopener noreferrer">${r.sourceName} ↗</a>${artistSource}${storySource}</div></article>`,'story');
}

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

// Featured portraits share the existing artist notes; listening remains a separate action.
const featuredArtists = [
  {id:'ydbb', image:'ydbb.jpg', width:2500, height:1667, alt:'The five members of YdBB seated in red cinema chairs', position:'50% 50%', title:'A farewell worth staying for.', deck:'Meet YdBB through <em>ONCE</em> — a song about parting, and the wish to be remembered kindly.'},
  {id:'whiteusedsocks', image:'whiteusedsocks-portrait.jpg', width:2400, height:2400, alt:'The four members of WhiteUsedSocks looking down toward the camera under a blue sky', position:'50% 20%', title:'A voice to spend time with.', deck:'Expressive vocals, emotional lyrics. Start with WhiteUsedSocks and their early single <em>Don’t feel sad</em>.'},
  {id:'motte', image:'motte-portrait.jpg', width:1500, height:1000, alt:'Motte wearing glasses and an orange jacket, seated beside a candle', position:'50% 40%', title:'A song beyond the screen.', deck:'Meet singer-songwriter Motte through <em>Don’t run away</em>, her contribution to the soundtrack of <em>A-TEEN</em>.'},
  {id:'hanroro', image:'hanroro-portrait.jpg', width:2400, height:2400, alt:'HANRORO in a white outfit against yellow floral wallpaper', position:'50% 20%', title:'Growing up, finding a voice.', deck:'Rock songs for the fears and hopes of growing up. Begin with HANRORO’s <em>Even if you leave</em>.'}
];

function initArtistCarousel(){
  const carousel=document.querySelector('#artist-carousel');
  const slidesRoot=carousel.querySelector('#hero-slides');
  const selectors=carousel.querySelector('#hero-artists');
  const rotation=carousel.querySelector('#hero-rotation');
  const position=carousel.querySelector('#hero-position');
  const status=carousel.querySelector('#hero-status');
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const interval=9000;
  let current=0;
  let wantsRotation=!reducedMotion.matches;
  let hovered=window.matchMedia('(hover: hover)').matches&&carousel.matches(':hover');
  let inView=false;
  let timer;
  let touchStart;
  let suppressClick=false;
  let rotationPress;

  carousel.setAttribute('role','region');
  carousel.setAttribute('aria-roledescription','carousel');
  slidesRoot.innerHTML=featuredArtists.map((feature,index)=>{
    const r=findRecord(feature.id);
    return `<div class="hero-slide ${index===0?'is-active':''}" id="hero-${r.id}" role="group" aria-roledescription="slide" aria-label="${r.artist}, ${index+1} of ${featuredArtists.length}" ${index===0?'':'aria-hidden="true" inert'}>
      <button class="hero-image hero-image-${r.id}" data-story="${r.id}" aria-label="Meet ${r.artist}">
        <img src="assets/${feature.image}?v=20261018-portraits" alt="${feature.alt}" width="${feature.width}" height="${feature.height}" style="object-position:${feature.position}" ${index===0?'fetchpriority="high"':'decoding="async"'} draggable="false">
        <span class="location-label mono">${r.artist} / <span lang="ko">${r.korean}</span></span>
        <span class="artist-stamp" aria-hidden="true">${r.artist}</span>
      </button>
      <div class="story-caption"><div><p class="eyebrow">MEET THE ARTIST <span lang="ko">${r.korean}</span></p><h2><button data-story="${r.id}">${feature.title}</button></h2></div><button class="round-arrow" data-story="${r.id}" aria-label="Read about ${r.artist}">↗</button></div>
      <p class="feature-deck">${feature.deck}</p>
    </div>`;
  }).join('');
  selectors.innerHTML=featuredArtists.map((feature,index)=>`<button data-feature="${index}" aria-controls="hero-${feature.id}" aria-pressed="${index===0}" aria-label="Show ${findRecord(feature.id).artist}"><span class="mono" aria-hidden="true">0${index+1}</span>${findRecord(feature.id).artist}</button>`).join('');
  const slides=[...slidesRoot.children];
  const choices=[...selectors.children];
  carousel.querySelector('.hero-toolbar').hidden=false;
  selectors.hidden=false;
  carousel.classList.add('is-ready');

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
    slides.forEach((slide,i)=>{
      const active=i===current;
      slide.classList.toggle('is-active',active);
      slide.inert=!active;
      if(active)slide.removeAttribute('aria-hidden');
      else slide.setAttribute('aria-hidden','true');
      choices[i].setAttribute('aria-pressed',String(active));
    });
    position.textContent=`0${current+1} / 0${slides.length}`;
    if(manual)status.textContent=`${findRecord(featuredArtists[current].id).artist}, ${current+1} of ${slides.length}`;
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
  new MutationObserver(syncRotation).observe(dialog,{attributes:true,attributeFilter:['open']});
  new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;syncRotation();},{threshold:0.25}).observe(carousel);
  reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)stop();});
  syncRotation();
}
initArtistCarousel();
