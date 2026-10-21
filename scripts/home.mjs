import {escapeHTML as e, artistId, artistPath, trackPath, trackAnchor, guidePath, getArtistRecords, getFeaturedArtists, getListeningGuides, formatPosition, imageHTML, coverHTML, saveButton, youtubeConsentHTML} from '../site/shared.mjs';
import {homeUpdates} from '../site/editorial.mjs';
import {publicStories, storyPath} from '../site/stories.mjs';

const fail = message => { throw new Error(`Home: ${message}`); };
function object(value, fields, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  for (const key of Object.keys(value)) if (!fields.includes(key)) fail(`unknown ${label} field: ${key}`);
}
function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be nonempty text`);
}
function ordered(items, ids, label) {
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length) fail(`${label} must contain unique IDs`);
  for (const id of ids) if (!items.some(item => item.id === id)) fail(`unknown or unpublished ${label}: ${id}`);
  return [...ids.map(id => items.find(item => item.id === id)), ...items.filter(item => !ids.includes(item.id))];
}
// Home decks support emphasis only. Layout and arbitrary HTML stay in templates.
function deckHTML(value) {
  if (/<(?!\/?em>)/.test(value)) fail('feature deck permits only <em> markup');
  let depth = 0;
  for (const tag of value.match(/<\/?em>/g) || []) {
    depth += tag === '<em>' ? 1 : -1;
    if (depth < 0 || depth > 1) fail('unbalanced feature deck emphasis');
  }
  if (depth) fail('unbalanced feature deck emphasis');
  return e(value).replaceAll('&lt;em&gt;', '<em>').replaceAll('&lt;/em&gt;', '</em>');
}
function featureList(section, context) {
  const base = getFeaturedArtists(context.catalogue);
  if (!Array.isArray(section.features)) fail('discover.features must be an array');
  for (const feature of section.features) object(feature, ['id','title','deck','image','alt','position','kind'], 'feature');
  const sorted = ordered(base, section.features.map(f => f.id), 'featured artist');
  return sorted.map(feature => {
    const override = section.features.find(f => f.id === feature.id) || {};
    object(override, ['id','title','deck','image','alt','position','kind'], 'feature');
    for (const key of Object.keys(override)) text(override[key], `feature.${key}`);
    if (override.image && (!override.alt || !override.kind)) fail(`feature ${feature.id}: custom image needs alt and kind`);
    const result = {...feature, ...override};
    if (!['portrait','artwork'].includes(result.kind)) fail(`invalid image kind: ${result.kind}`);
    if (!/^\d+(?:\.\d+)?% \d+(?:\.\d+)?%$/.test(result.position)) fail(`invalid image position: ${result.position}`);
    if (!context.media[result.image] || !context.rights.images.some(image => image.file === result.image)) fail(`uncredited or missing feature image: ${result.image}`);
    result.deck = override.deck ? deckHTML(override.deck) : feature.deck;
    return result;
  });
}

function spotlightList(section, context) {
  const ids = section.spotlightArtistIds === undefined ? [] : section.spotlightArtistIds;
  if (!Array.isArray(ids) || ids.length > 2 || new Set(ids).size !== ids.length) fail('spotlightArtistIds needs up to two distinct artists');
  const artists = getArtistRecords(context.catalogue);
  return ids.map(id => {
    const record = artists.find(record => artistId(record) === id);
    if (!record) fail(`unknown spotlight artist: ${id}`);
    const lyrics = context.tracks.find(track => artistId(track) === id && track.lyricNotes);
    const session = record.performances?.[0];
    const story = context.stories.find(story => story.artistIds?.includes(id));
    const links = [];
    if (lyrics) links.push({href:`${artistPath(lyrics)}#${trackAnchor(lyrics)==='listen'?'lyrics':`lyrics-${lyrics.id}`}`,label:'Inside the lyrics'});
    if (session) links.push({href:`${artistPath(record)}#${session.id}`,label:'Full live session'});
    if (story) links.push({href:storyPath(story),label:'Read the story'});
    if (record.moreTracks?.length) links.push({href:`${artistPath(record)}#more-listens-title`,label:'More songs'});
    if (!links.length) links.push({href:trackPath(record),label:'Listen & read'});
    return {record,links:links.slice(0,3)};
  });
}

// Each current design owns its markup and singleton DOM IDs. A new design adds
// one registry entry and, when needed, a template; the catalogue remains stable.
const sectionTypes = {
  masthead: {copy:['label','topLeft','topRight','eyebrow','title','link','bottomLeft','bottomRight'], render:templateSection('masthead')},
  updates: {copy:['eyebrow','title','intro'], render:renderUpdates},
  story: {
    fields:['storyId'], copy:['eyebrow','link','allLink'],
    resolve(section, context) {
      if (section.storyId !== null) text(section.storyId, 'storyId (or use null for latest)');
      const story = section.storyId === null ? context.stories[0] : context.stories.find(story => story.id === section.storyId);
      if (section.storyId && !story) fail(`unknown or unpublished story: ${section.storyId}`);
      return {story};
    },
    render(section, context) {
      if (!section.story) return '';
      return context.storyHome(section.story, {copy:section.copy, showCover:section.showImage}).replace('<section ', `<section data-home-section="${e(section.id)}" `);
    },
  },
  discover: {
    fields:['features','trackOrder','spotlightArtistIds'], copy:['eyebrow','roomEyebrow','roomTitle','roomIntro','roomLink'],
    resolve(section, context) { return {features:featureList(section,context), tracks:ordered(context.tracks,section.trackOrder,'trackOrder'),spotlights:spotlightList(section,context)}; },
    render(section, context) {
      const count = section.tracks.length;
      return templateSection('discover')(section,context,{
        FEATURE_COUNT:formatPosition(section.features.length), HERO:section.features.map((f,i)=>hero(f,i,section.features.length,context)).join(''),
        TRACKS:section.tracks.map(trackLink).join(''), ROOM_COUNT:count,
        SIDEBAR_CLASS:section.spotlights.length?' has-spotlights':'',
        SPOTLIGHTS:section.spotlights.length?`<div class="artist-spotlights" aria-label="More artists to explore">${section.spotlights.map(spotlight).join('')}</div>`:'',
        ROOM_HINT:count>6?`<p class="room-list-hint" id="room-list-hint">Scroll to explore all ${count} tracks <span aria-hidden="true">↓</span></p>`:'',
      });
    },
  },
  directory: {copy:['title'], render:templateSection('directory')},
  pick: {
    fields:['trackId'], copy:['eyebrow','link'], optionalCopy:['description'],
    resolve(section, context) {
      const track = context.tracks.find(track => track.id === section.trackId);
      if (!track) fail(`unknown pick track: ${section.trackId}`);
      return {track};
    },
    render:renderPick,
  },
  guides: {
    fields:['guideOrder','layout'], copy:['eyebrow','title','link','introBefore','introLink','introAfter'],
    resolve(section, context) {
      const layout = section.layout ?? 'cards';
      if (!['cards','links'].includes(layout)) fail(`unknown guides layout: ${layout}`);
      return {layout,guides:ordered(context.guides, section.guideOrder, 'guideOrder')};
    },
    render(section, context) {
      const compact = section.layout === 'links';
      const links = () => `<div class="guide-links">${section.guides.map(guide=>{
        const count = guide.records.length + (guide.moreRecords?.length || 0);
        return `<a class="guide-link" href="${guidePath(guide)}" data-guide="${guide.id}" data-track-count="${count}"><span class="mono">${count} TRACKS</span><h3>${e(guide.title)}</h3><span class="guide-link-arrow" aria-hidden="true">↗</span></a>`;
      }).join('')}</div>`;
      return templateSection('guides')(section,context,{LAYOUT_CLASS:compact?' guides-compact':'',GUIDES:compact?links():context.guideCards('h3',true,section.guides,section.imageGuideIds)});
    },
  },
  closing: {copy:['eyebrow','title','body','link'], render:templateSection('closing')},
};

export function resolveHome(source, context) {
  object(source,['schemaVersion','title','description','sections'],'document');
  if (source.schemaVersion !== 1) fail('expected schemaVersion 1');
  text(source.title,'title'); text(source.description,'description');
  if (!Array.isArray(source.sections) || !source.sections.length) fail('sections must be a nonempty array');
  const catalogue = context.catalogue;
  context = {...context, stories:publicStories(context.stories || []), tracks:[...catalogue.records,catalogue.editorPick], guides:getListeningGuides(catalogue)};
  const ids = new Set(), types = new Set();
  const sections = source.sections.map(section => {
    const type = Object.hasOwn(sectionTypes,section?.type) && sectionTypes[section.type];
    if (!type) fail(`unknown section type: ${section?.type}`);
    object(section,['id','type','enabled','copy',...(type.fields || [])],'section');
    if (typeof section.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(section.id) || ids.has(section.id)) fail(`invalid or duplicate section ID: ${section.id}`);
    if (types.has(section.type)) fail(`duplicate singleton section type: ${section.type}`);
    ids.add(section.id); types.add(section.type);
    if (typeof section.enabled !== 'boolean') fail(`section ${section.id} needs boolean enabled`);
    object(section.copy,[...type.copy,...(type.optionalCopy || [])],`${section.id}.copy`);
    for (const key of type.copy) text(section.copy[key],`${section.id}.copy.${key}`);
    for (const key of type.optionalCopy || []) if (key in section.copy) text(section.copy[key],`${section.id}.copy.${key}`);
    // Validate references even while hidden, so re-enabling cannot expose stale content.
    return {...section,...type.resolve?.(section,context)};
  }).filter(section => section.enabled);

  // Reserve hero photographs first, then story/pick/guide art. Reordering sections
  // never duplicates an image or changes which section owns it.
  const images = new Set();
  for (const feature of sections.find(s=>s.type==='discover')?.features || []) {
    if (images.has(feature.image)) fail(`duplicate hero image ${feature.image}; choose another credited feature image`);
    images.add(feature.image);
  }
  const claim = file => { if (!file || images.has(file)) return false; images.add(file); return true; };
  const story = sections.find(s=>s.type==='story');
  if (story) story.showImage = claim(story.story?.cover?.file);
  const pick = sections.find(s=>s.type==='pick');
  if (pick) pick.showImage = claim(pick.track.image);
  const guides = sections.find(s=>s.type==='guides');
  if (guides && guides.layout === 'cards') {
    guides.imageGuideIds = [];
    // Keep each guide's preferred image when available before assigning fallbacks.
    const candidates = guides.guides.map(guide => {
      const members = [...guide.records,...(guide.moreRecords || [])];
      const preferred = guide.cardImageArtistId ? members.find(track=>artistId(track)===guide.cardImageArtistId) : members[0];
      return {guide,members,artwork:claim(preferred.image)?preferred:null};
    });
    guides.guides = candidates.map(({guide,members,artwork}) => {
      artwork ||= members.find(track=>claim(track.image));
      if (artwork) guides.imageGuideIds.push(guide.id);
      return {...guide,cardArtwork:artwork};
    });
  }
  return {title:source.title,description:source.description,sections};
}

function templateSection(name) {
  return (section,context,extra={}) => {
    const copy = Object.fromEntries(Object.entries(section.copy).map(([key,value])=>[key.replace(/[A-Z]/g,letter=>'_'+letter).toUpperCase(),e(value).replaceAll('\n','<br>')]));
    const values = {SECTION_ID:e(section.id),ARTIST_COUNT:context.artists.length,GUIDE_ARTIST_COUNT:context.artists.length,...copy,...extra};
    return context.template(`home/${name}.html`).replace(/\{\{([A-Z_]+)\}\}/g,(_,key)=>{
      if (!(key in values)) fail(`missing template value: ${name}.${key}`);
      return values[key];
    });
  };
}

export function renderHome(home, context) {
  context = {...context,artists:getArtistRecords(context.catalogue)};
  const lead = home.sections.find(section=>section.type==='story')?.story;
  context = {...context,excludePaths:lead?[storyPath(lead)]:[]};
  const html = home.sections.map(section=>sectionTypes[section.type].render(section,context));
  const has = type => home.sections.some(section=>section.type===type);
  if (!has('masthead')) html.unshift('<h1 class="sr-only">indiek</h1>');
  // Old home URLs keep useful destinations even when their sections are hidden.
  const fallbacks = [
    ['discover','discover','/artists/','Discover the artists'],
    ['directory','records','/artists/',`Browse all ${context.artists.length} artists`],
    ['pick','editors-pick','/artists/','Find another song'],
    ['guides','notes','/notes/first-listens/','Explore the listening guides'],
    ['closing','about','/about/','About indiek'],
  ].filter(([type])=>!has(type));
  if (fallbacks.length) html.push(`<nav class="home-fallback wrap" aria-label="More from indiek">${fallbacks.map(([,id,href,label])=>`<a class="underlink" id="${id}" href="${href}">${e(label)} ↗</a>`).join('')}</nav>`);
  return context.template('home.html').replace('{{SECTIONS}}',html.filter(Boolean).join('\n\n'));
}

function hero(feature,i,count,context) {
  const r = context.artists.find(r=>artistId(r)===feature.id);
  return `<div class="hero-slide${i===0?' is-active':''}" id="hero-${artistId(r)}" data-hero-artist="${artistId(r)}"${i?' hidden aria-hidden="true" inert':''} role="group" aria-roledescription="slide" aria-label="${e(r.artist)}, ${i+1} of ${count}">
  <a class="hero-image hero-image-${artistId(r)} hero-image-${feature.kind}" href="${artistPath(r)}" aria-label="Meet ${e(r.artist)}">${imageHTML(context.media,feature.image,feature.alt,{priority:i===0,deferred:i!==0,sizes:feature.kind==='artwork'?'(max-width: 760px) 48vw, 32vw':'(max-width: 760px) calc(100vw - 36px), 62vw',style:`object-position:${feature.position}`})}<span class="location-label mono">${feature.kind==='artwork'?'RELEASE ARTWORK':`${e(r.artist)} / <span lang="ko">${e(r.korean)}</span>`}</span><span class="artist-stamp" aria-hidden="true">${e(r.artist)}</span></a>
  <div class="story-caption"><div><p class="eyebrow">MEET THE ARTIST <span lang="ko">${e(r.korean)}</span></p><h2><a href="${artistPath(r)}">${e(feature.title)}</a></h2></div><a class="round-arrow" href="${artistPath(r)}" aria-label="Read about ${e(r.artist)}">↗</a></div><p class="feature-deck">${feature.deck}</p>${context.photoCredit(feature.image)}</div>`;
}
function trackLink(r,i) {
  return `<li><a class="track" data-room-track="${r.id}" href="${trackPath(r)}" aria-label="Listen to ${e(r.track)} by ${e(r.artist)}"><span class="track-number" aria-hidden="true">${formatPosition(i+1)}</span><span class="track-info"><strong>${e(r.track)}</strong><span>${e(r.artist)}</span></span>${r.duration?`<span class="track-time">${r.duration}</span>`:''}<span class="track-play" aria-hidden="true">▷</span></a></li>`;
}
function spotlight({record:r,links},i) {
  return `<article class="artist-spotlight" data-spotlight-artist="${artistId(r)}"><p class="eyebrow">${formatPosition(i+1)} / MORE TO EXPLORE</p><h3><a href="${artistPath(r)}">${e(r.artist)} <span aria-hidden="true">↗</span></a></h3><p class="spotlight-note">${e(r.description)}</p><div class="spotlight-links">${links.map(link=>`<a class="underlink" href="${link.href}">${e(link.label)} <span aria-hidden="true">↗</span></a>`).join('')}</div></article>`;
}
function renderPick(section,context) {
  const {track:r,copy} = section;
  const release = r.release || r.album;
  const type = release?.match(/ - (Single|EP)$/)?.[1];
  const date = [type,r.releaseDate || r.releaseYear || r.year].filter(Boolean).join(' / ').toUpperCase();
  return `<section data-home-section="${e(section.id)}" class="editor-pick pick-preview wrap${section.showImage?'':' home-text-only'}" id="editors-pick" aria-labelledby="editors-pick-title">${section.showImage?`<figure class="pick-artwork"><a href="${trackPath(r)}" aria-label="Listen to ${e(r.track)} by ${e(r.artist)}">${coverHTML(context.media,r,{sizes:'(max-width: 760px) 90vw, 40vw'})}</a><figcaption>${e(release)} · Release artwork</figcaption></figure>`:''}<div class="pick-copy"><p class="eyebrow">${e(copy.eyebrow)} / ${e(r.genre.split(' / ')[0])}</p><h2 id="editors-pick-title"><a href="${artistPath(r)}">${e(r.artist)}</a><span>${e(r.track)}${r.koreanTitle?` <span lang="ko">(${e(r.koreanTitle)})</span>`:''}</span></h2>${date?`<p class="pick-date mono">${e(date)}</p>`:''}<div class="pick-reading"><p>${e(copy.description || r.description)}</p><div class="pick-actions"><button class="underlink" data-load-player="${r.id}" data-js-only hidden>Agree &amp; play</button>${r.id!==context.catalogue.editorPick.id?saveButton(r,true):''}<a class="underlink" href="${trackPath(r)}">${e(copy.link)} <span aria-hidden="true">↗</span></a></div>${youtubeConsentHTML()}</div></div></section>`;
}
function renderUpdates(section,context) {
  const recent = homeUpdates(context.entries,context.updates,{preview:context.preview,excludePaths:context.excludePaths});
  if (!recent.length) return '';
  const {copy} = section;
  return `<section data-home-section="${e(section.id)}" class="latest-section wrap" id="latest" aria-labelledby="latest-title"><div class="section-heading"><div><p class="eyebrow">${e(copy.eyebrow)}</p><h2 id="latest-title">${e(copy.title)}</h2></div><p class="latest-intro">${e(copy.intro)}</p></div><div class="latest-list">${recent.map(item=>`<a href="${e(item.path)}" data-home-update="${e(item.id)}"><span class="latest-meta mono"><span>${e(item.label.toUpperCase())}</span>${item.date?`<time datetime="${item.date}">${item.date}</time>`:''}</span><h3>${e(item.title)}</h3><p>${e(item.description)}</p><span class="latest-arrow" aria-hidden="true">↗</span></a>`).join('')}</div></section>`;
}
