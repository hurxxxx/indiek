"""Check every generated page, local navigation, metadata and catalogue asset."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
from html import escape, unescape
import subprocess
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta

root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
catalogue = json.loads(subprocess.check_output(['node', str(root/'scripts/catalogue.mjs'), str(root)], text=True))
home_source = json.loads((root/'content/home.json').read_text())
home_sections = {s['type']:s for s in home_source['sections'] if s['enabled']}
tracks = catalogue['records']+[catalogue['editorPick']]
by_id = {track['id']:track for track in tracks}
artists = list({track['artistId']:by_id[track['primaryTrackId']] for track in tracks}.values())
def artist_path(track): return f"/artists/{track['artistId']}/"
def track_path(track): return artist_path(track) + ('#listen' if track['id']==track['primaryTrackId'] else '#track-'+track['id'])
def lyrics_anchor(track): return 'lyrics' if track['id']==track['primaryTrackId'] else 'lyrics-'+track['id']
# Song page paths, index status and similar songs come from scripts/song-pages.mjs, the rule the build uses.
song_pages = json.loads(subprocess.check_output(['node', str(root/'scripts/song-pages.mjs'), str(root)], text=True))
def song_path(track): return song_pages[track['id']]['path']
def song_ready(track): return song_pages[track['id']]['ready']
def reading_path(track): return song_path(track) if song_ready(track) else track_path(track)
site = catalogue['site']
errors = []
today = datetime.now(timezone(timedelta(hours=9))).date().isoformat()
polls = json.loads((root/'content/polls.json').read_text())['polls']
public_polls = [poll for poll in polls if poll['status']!='draft']
stories = sorted([s for file in (root/'content/stories').glob('*.json') for s in [json.loads(file.read_text())] if s['status']=='published' and s['published']<=today], key=lambda s: (-int(s['published'].replace('-','')),s['id']))

class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(); self.path=path; self.refs=[]; self.ids=set(); self.meta={}; self.canonical=[]; self.h1=0; self.frames=0
        self.guide_cards=[]; self.guide_tracks=[]; self.guide_more=[]; self.guide_id=None
        self.room_tracks=[]; self.room_count=None; self.directory_artists=[]; self.images=[]; self.nav=[]
        self.home_sections=[]; self.hero_artists=[]; self.song_id=None; self.similar=[]; self.loads=[]; self.saves=[]
        self.poll_id=None; self.poll_choices=[]; self.request_page=False; self.request_form=False
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'data-home-section' in a: self.home_sections.append(a['data-home-section'])
        if 'data-hero-artist' in a: self.hero_artists.append(a['data-hero-artist'])
        if 'data-directory-artist' in a: self.directory_artists.append(a['data-directory-artist'])
        if 'data-nav-section' in a: self.nav.append((a['data-nav-section'],a.get('href'),a.get('aria-current')))
        if 'data-room-count' in a: self.room_count=int(a['data-room-count'])
        if 'data-room-track' in a: self.room_tracks.append((a['data-room-track'],a.get('href')))
        if 'data-guide' in a: self.guide_cards.append((a['data-guide'],int(a['data-track-count'])))
        if 'data-guide-track' in a: self.guide_tracks.append((a['data-guide-track'],a.get('href')))
        if 'data-guide-more' in a: self.guide_more.append(a['data-guide-more'])
        if 'data-guide-page' in a: self.guide_id=a['data-guide-page']
        if 'data-song-page' in a: self.song_id=a['data-song-page']
        if 'data-poll' in a: self.poll_id=a['data-poll']
        if 'data-poll-choice' in a: self.poll_choices.append(a['data-poll-choice'])
        if 'data-request-page' in a: self.request_page=True
        if 'data-request-form' in a: self.request_form=True
        if 'data-similar-song' in a: self.similar.append(a['data-similar-song'])
        if 'data-load-player' in a: self.loads.append(a['data-load-player'])
        if 'data-save' in a: self.saves.append(a['data-save'])
        if 'id' in a:
            if a['id'] in self.ids: errors.append(f'{self.path}: duplicate id {a["id"]}')
            self.ids.add(a['id'])
        for key in ('href','src','data-src'):
            if a.get(key): self.refs.append(a[key])
        for key in ('srcset','data-srcset'):
            if a.get(key): self.refs.extend(item.strip().split()[0] for item in a[key].split(','))
        if tag=='img':
            self.images.append(a.get('src',a.get('data-src','')))
            if not a.get('alt'): errors.append(f'{self.path}: image missing alt text')
            if not a.get('width') or not a.get('height'): errors.append(f'{self.path}: image dimensions missing')
            if '/optimized/' not in a.get('src',a.get('data-src','')): errors.append(f'{self.path}: unoptimized display image')
        if tag=='h1': self.h1+=1
        if tag=='iframe': self.frames+=1
        if tag=='meta': self.meta[a.get('property',a.get('name',''))]=a.get('content','')
        if tag=='link' and a.get('rel')=='canonical': self.canonical.append(a.get('href'))

pages={}
for path in dist.rglob('*.html'):
    page=Page(path.relative_to(dist)); text=path.read_text(); page.feed(text); pages[path.resolve()]=page
    relative=path.relative_to(dist).as_posix().removesuffix('index.html')
    expected=site['url']+'/'+relative
    if page.canonical!=[expected] or page.meta.get('og:url')!=expected: errors.append(f'{path}: incorrect canonical or og:url')
    for key in ['description','og:title','og:description','og:image','twitter:card','twitter:image']:
        if not page.meta.get(key): errors.append(f'{path}: missing {key}')
    sharing=urlsplit(page.meta.get('og:image','')).path
    if not sharing.startswith('/assets/social/') or not (dist/sharing.lstrip('/')).is_file(): errors.append(f'{path}: missing page sharing image')
    if page.meta.get('og:image')!=page.meta.get('twitter:image'): errors.append(f'{path}: sharing images disagree')
    if site.get('googleSiteVerification') and page.meta.get('google-site-verification')!=site['googleSiteVerification']: errors.append(f'{path}: missing or incorrect Google site verification')
    if page.h1!=1: errors.append(f'{path}: expected one h1')
    if 'analytics-notice' not in page.ids: errors.append(f'{path}: missing analytics choice')
    if 'persistent-player' not in page.ids or text.index('id="persistent-player"') < text.index('</main>'): errors.append(f'{path}: shared player must be outside replaceable page content')
    if any('matomo.lumejs.com' in ref for ref in page.refs): errors.append(f'{path}: Matomo loaded before consent')
    if page.frames: errors.append(f'{path}: player loaded without consent')
    if '{{' in text or 'lumejs.chatgpt.site' in text or 'data-story=' in text: errors.append(f'{path}: stale template content')
    if re.fullmatch(r'artists/[^/]+/', relative):
        # Search titles name the opening song; structured recordings must point at anchors on this page.
        ld=re.search(r'<script type="application/ld\+json">(.*?)</script>', text, re.S)
        nodes=json.loads(ld.group(1)).get('@graph', []) if ld else []
        groups=[n for n in nodes if n.get('@type')=='MusicGroup']
        recordings=[n for n in nodes if n.get('@type')=='MusicRecording']
        artist_id=relative.split('/')[1]
        opening=next((t for t in artists if t['artistId']==artist_id), None)
        if len(groups)!=1 or not recordings: errors.append(f'{path}: missing artist structured data')
        # Complete songs point at their own page; incomplete ones at the section on this page.
        allowed={site['url']+song_path(t) for t in tracks if t['artistId']==artist_id and song_ready(t)}
        for recording in recordings:
            url=recording.get('url','')
            anchor=urlsplit(url).fragment
            if not (url in allowed or (url.startswith(page.canonical[0]+'#') and anchor in page.ids)) or recording.get('byArtist',{}).get('@id')!=(groups[0]['@id'] if groups else None): errors.append(f'{path}: structured recording does not match the page')
        for t in tracks:
            if t['artistId']==artist_id and song_path(t) not in page.refs: errors.append(f'{path}: missing link to song page {song_path(t)}')
        title=re.search(r'<title>(.*?)</title>', text, re.S)
        title=unescape(title.group(1)) if title else ''
        if opening and re.sub(r'\s*\(feat\.[^)]*\)','',opening['track'],flags=re.I) not in title: errors.append(f'{path}: search title must name the opening song')
    section='stories' if relative.startswith('stories/') else 'artists' if relative.startswith('artists/') else 'guides' if relative.startswith('notes/') else 'home' if not relative else None
    expected_nav=[(id,href,('page' if href=='/'+relative else 'true') if id==section else None) for id,href in [('home','/'),('stories','/stories/'),('artists','/artists/'),('guides','/notes/first-listens/')]]
    if page.nav!=expected_nav: errors.append(f'{path}: incorrect main navigation or current section')
    for required in ['/stories/','/artists/','/notes/first-listens/','/about/','/privacy-and-terms/','mailto:'+site['email']]:
        if required not in page.refs: errors.append(f'{path}: missing public navigation {required}')

for path,page in pages.items():
    for ref in page.refs:
        url=urlsplit(ref)
        if url.scheme=='mailto': continue
        if url.netloc and url.netloc!=urlsplit(site['url']).netloc: continue
        target=(dist/unquote(url.path).lstrip('/')) if url.path.startswith('/') else path.parent/unquote(url.path) if url.path else path
        if target.is_dir(): target=target/'index.html'
        target=target.resolve()
        if not target.is_file(): errors.append(f'{page.path}: missing target {ref}'); continue
        if url.fragment and target in pages and unquote(url.fragment) not in pages[target].ids:
            errors.append(f'{page.path}: missing anchor {ref}')

for file in ['styles.css','assets/fonts.css']:
    css=dist/file
    for ref in re.findall(r'url\([\'"]?([^\)\'\"]+)',css.read_text()):
        if not (css.parent/ref).is_file(): errors.append('Missing CSS asset: '+ref)

media=json.loads((root/'content/media.json').read_text())
rights=json.loads((root/'content/image-rights.json').read_text())
credits={entry['file'] for entry in rights['images']}
for record in tracks:
    if record['image'] not in media or record['image'] not in credits: errors.append('Missing image metadata: '+record['id'])
    target=(dist/'artists'/record['artistId']/'index.html').resolve()
    if target not in pages: errors.append('Missing artist page: '+record['id'])
    else:
        text=target.read_text()
        if record['videoId'] not in text: errors.append('Missing direct video link: '+record['id'])
        if record.get('externalOnly') and f'data-load-player="{record["id"]}"' in text: errors.append('External-only performance has an embed: '+record['id'])
        notes=record.get('lyricNotes')
        song_file=(dist/song_path(record).lstrip('/')/'index.html').resolve()
        if not notes: errors.append('Missing lyric commentary: '+record['id'])
        elif song_file not in pages: errors.append('Missing song page: '+record['id'])
        else:
            if lyrics_anchor(record) not in pages[target].ids: errors.append('Missing lyric anchor: '+record['id'])
            if 'lyrics' not in pages[song_file].ids: errors.append('Missing song page lyric anchor: '+record['id'])
            for file in [song_file]+([] if song_ready(record) else [target]):
                body=file.read_text()
                for paragraph in notes['paragraphs']:
                    if escape(paragraph).replace('&#x27;', '&#39;') not in body: errors.append('Stale or missing lyric commentary: '+record['id'])
                for stanza in notes.get('translation',{}).get('stanzas',[]):
                    rendered=escape(stanza).replace('&#x27;', '&#39;').replace('\n','<br>')
                    if rendered not in body: errors.append('Stale or missing lyric adaptation: '+record['id'])
                for source in [notes['source'], *notes.get('backgroundSources',[])]:
                    if source['url'] not in pages[file].refs: errors.append('Missing lyric source: '+record['id'])
# Song pages: one per catalogue track at /artists/<artist-id>/<slug>/, indexed only when complete.
song_paths=[song_pages.get(t['id'],{}).get('path') for t in tracks]
if len(set(song_paths))!=len(tracks): errors.append('Song pages must have one unique path per track')
for record in tracks:
    status=song_pages.get(record['id'])
    if not status or status['path']!=f"/artists/{record['artistId']}/{record.get('slug')}/": errors.append('Missing or misplaced song page: '+record['id']); continue
    file=(dist/status['path'].lstrip('/')/'index.html').resolve()
    song=pages.get(file)
    if not song: errors.append('Missing song page: '+status['path']); continue
    text=file.read_text(); label='Song page '+status['path']
    if song.song_id!=record['id']: errors.append(f'{label}: wrong song identity')
    if (song.meta.get('robots')=='noindex')==status['ready']: errors.append(f"{label}: noindex must follow completeness (missing: {', '.join(status['missing']) or 'nothing'})")
    if record['id'] not in song.loads or record['videoId'] not in text: errors.append(f'{label}: missing shared-player button or direct video link')
    if (record['id']!=catalogue['editorPick']['id'])!=(record['id'] in song.saves): errors.append(f'{label}: save button must follow Saved eligibility')
    if artist_path(record) not in song.refs or record['source'] not in song.refs: errors.append(f'{label}: missing artist or release link')
    for field in ['credits','listeningNote','description']:
        if record.get(field) and escape(record[field]).replace('&#x27;','&#39;') not in text: errors.append(f'{label}: missing {field}')
    for source in [*record.get('extraSources',[]), *record.get('lyricNotes',{}).get('backgroundSources',[])] if record.get('listeningNote') else []:
        if source['url'] not in song.refs: errors.append(f'{label}: missing background source')
    title=re.search(r'<title>(.*?)</title>', text, re.S)
    title=unescape(title.group(1)) if title else ''
    if record['artist'] not in title or re.sub(r'\s*\(feat\.[^)]*\)','',record['track'],flags=re.I) not in title: errors.append(f'{label}: search title must name the artist and song')
    similar=[by_id.get(id) for id in song.similar]
    if song.similar!=status['similar'] or len(similar)!=3 or any(not t or t['artistId']==record['artistId'] or reading_path(t) not in song.refs for t in similar): errors.append(f'{label}: needs three linked similar songs by other artists')
    ld=re.search(r'<script type="application/ld\+json">(.*?)</script>', text, re.S)
    nodes=json.loads(ld.group(1)).get('@graph', []) if ld else []
    recording=next((n for n in nodes if n.get('@type')=='MusicRecording'), {})
    crumbs=next((n for n in nodes if n.get('@type')=='BreadcrumbList'), {}).get('itemListElement', [])
    if recording.get('url')!=song.canonical[0] or recording.get('byArtist',{}).get('@id')!=site['url']+artist_path(record)+'#artist' or not crumbs or crumbs[-1].get('item')!=song.canonical[0]: errors.append(f'{label}: structured data must describe this song page')
for name, image in media.items():
    if name not in credits: errors.append('Missing image credit: '+name)
    for variant in image['variants']:
        if not (dist/variant['src'].lstrip('/')).is_file(): errors.append('Missing variant: '+name)
image_families={variant['src']:name for name,image in media.items() for variant in image['variants']}
for page in pages.values():
    images=[image_families.get(src,src) for src in page.images]
    if len(images)!=len(set(images)): errors.append(f'{page.path}: repeated artist image or release cover')

sitemap_ns='{http://www.sitemaps.org/schemas/sitemap/0.9}'
sitemap_entries=ET.parse(dist/'sitemap.xml').findall(f'.//{sitemap_ns}url')
urls={entry.findtext(f'{sitemap_ns}loc') for entry in sitemap_entries}
if urls!={p.canonical[0] for p in pages.values() if p.meta.get('robots')!='noindex'}: errors.append('Sitemap does not match generated indexable pages')
seoul_today=datetime.now(timezone(timedelta(hours=9))).date().isoformat()
for entry in sitemap_entries:
    lastmod=entry.findtext(f'{sitemap_ns}lastmod') or ''
    # Dates come from scripts/sitemap.mjs: the Korea-time day a page's content last changed.
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}',lastmod) or lastmod>seoul_today: errors.append(f'Sitemap lastmod missing or in the future: {entry.findtext(f"{sitemap_ns}loc")}')
home=pages[(dist/'index.html').resolve()]
section_ids=[s['id'] for s in home_source['sections'] if s['enabled']]
if home.home_sections!=[id for id in section_ids if id in home.home_sections]: errors.append('Home sections disagree with configured order or visibility')
for section in home_sections.values():
    if section['type'] not in ['updates','story'] and section['id'] not in home.home_sections: errors.append('Missing home section: '+section['id'])
if not {'discover','records','editors-pick','notes','about'}.issubset(home.ids): errors.append('Missing legacy home destination')
directory=pages.get((dist/'artists/index.html').resolve())
artist_ids=[r['artistId'] for r in artists]
discover=home_sections.get('discover')
expected_hero=list(dict.fromkeys([f['id'] for f in discover['features']]+[f['id'] for f in catalogue['featuredArtists']]+artist_ids)) if discover else []
if home.hero_artists!=expected_hero: errors.append('Home hero must include all artists in configured order')
if not directory or sorted(directory.directory_artists)!=sorted(artist_ids): errors.append('Artist directory must include each artist and editor pick exactly once')
if f'Browse all {len(artist_ids)} artists' not in (dist/'index.html').read_text(): errors.append('Home directory link count does not match all artists')
room_ids=list(dict.fromkeys(discover['trackOrder']+[r['id'] for r in tracks])) if discover else []
expected_room=[(id,track_path(by_id[id])) for id in room_ids]
if home.room_tracks!=expected_room: errors.append('Listening room does not match the complete catalogue')
if home.room_count!=(len(expected_room) if discover else None): errors.append('Listening room count does not match its tracks')
if 'undefined' in (dist/'index.html').read_text(): errors.append('Undefined content on the homepage')
guide_ids=[g['id'] for g in sorted(catalogue['listeningGuides'],key=lambda g:g.get('selection')!='curated') if g.get('status')!='draft']
guide_counts={}
covered=set()
for id in guide_ids:
    guide_page=pages.get((dist/'notes'/id/'index.html').resolve())
    if not guide_page:
        errors.append('Missing listening guide: '+id); continue
    if guide_page.guide_id!=id: errors.append('Wrong guide identity: '+id)
    members=[r for r,href in guide_page.guide_tracks]+guide_page.guide_more
    guide_counts[id]=len(members)
    covered.update(r for r,href in guide_page.guide_tracks)
    if not members or len(members)!=len(set(members)): errors.append('Empty or duplicate guide tracks: '+id)
    for record_id,href in guide_page.guide_tracks:
        if record_id not in by_id or href!=reading_path(by_id[record_id]): errors.append('Wrong guide listening link: '+id)
    for record_id in guide_page.guide_more:
        if record_id not in by_id or artist_path(by_id[record_id]) not in guide_page.refs: errors.append('Missing follow-on artist link: '+id)
    # Curated guides open with contents; the introductory guide links every artist page and every complete song page.
    source_guide=next(g for g in catalogue['listeningGuides'] if g['id']==id)
    if source_guide.get('selection')=='curated' and any(f'#guide-{r}' not in guide_page.refs for r,href in guide_page.guide_tracks): errors.append('Missing guide contents link: '+id)
    if source_guide.get('includeCatalogue'):
        member_ids=[r for r,href in guide_page.guide_tracks]+guide_page.guide_more
        linked={urlsplit(ref).path for ref in guide_page.refs}
        for t in tracks:
            if artist_path(t) not in linked: errors.append(f'Introductory guide misses artist page {artist_path(t)}')
            if t['id'] in member_ids and song_ready(t) and song_path(t) not in linked: errors.append(f'Introductory guide misses song page {song_path(t)}')
if covered!={r['id'] for r in catalogue['records']+[catalogue['editorPick']]}: errors.append('Listening guides do not cover the catalogue')
for file in ['index.html','notes/first-listens/index.html']:
    index=pages.get((dist/file).resolve())
    selected=guide_ids if file!='index.html' else list(dict.fromkeys(home_sections['guides']['guideOrder']+guide_ids)) if 'guides' in home_sections else []
    if not index or index.guide_cards!=[(id,guide_counts.get(id)) for id in selected]: errors.append('Guide cards disagree with guide pages: '+file)
    elif any(f'/notes/{id}/' not in index.refs for id in selected): errors.append('Guide card link missing: '+file)
# Listener polls and reader requests: pages from content/polls.json (drafts only in local previews) and /request/.
for poll in polls:
    poll_file=(dist/'polls'/poll['id']/'index.html').resolve()
    if poll['status']=='draft':
        if poll_file in pages: errors.append(f"dist/polls/{poll['id']}/ is a draft preview; run npm run build before checking or deploying")
        continue
    page=pages.get(poll_file)
    if not page: errors.append('Missing poll page: '+poll['id']); continue
    expected=poll.get('choiceIds') or [t['id'] for t in tracks]
    if page.poll_id!=poll['id'] or sorted(page.poll_choices)!=sorted(expected): errors.append(f"Poll page {poll['id']}: choices must match the poll")
    for id in expected:
        if id not in page.loads or (id!=catalogue['editorPick']['id'])!=(id in page.saves) or reading_path(by_id[id]) not in page.refs: errors.append(f"Poll page {poll['id']}: {id} needs the shared-player button, Saved eligibility and its page link")
    if '/privacy-and-terms/#participation' not in page.refs: errors.append(f"Poll page {poll['id']}: missing privacy link")
request=pages.get((dist/'request/index.html').resolve())
if not request or not request.request_page or not request.request_form or '/privacy-and-terms/#participation' not in request.refs: errors.append('Missing request page, form or privacy link')
privacy=pages.get((dist/'privacy-and-terms/index.html').resolve())
if not privacy or 'participation' not in privacy.ids: errors.append('Privacy notice must describe listener polls and requests (#participation)')
for t in tracks:
    if f"/request/?artist={t['artistId']}" not in pages[(dist/artist_path(t).lstrip('/')/'index.html').resolve()].refs: errors.append('Missing request link: '+artist_path(t))
    if f"/request/?track={t['id']}" not in pages[(dist/song_path(t).lstrip('/')/'index.html').resolve()].refs: errors.append('Missing request link: '+song_path(t))
expected_count=len(artists)+len(tracks)+7+len(guide_ids)+len(stories)+len(public_polls)
if len(pages)!=expected_count: errors.append(f'Expected {expected_count} pages, found {len(pages)}')
if site['url']+'/sitemap.xml' not in (dist/'robots.txt').read_text(): errors.append('Missing robots sitemap')
for source,target in [(f'site/{name}',f'dist/{name}') for name in ['app.js','analytics.mjs','navigation.mjs','directory.mjs','mobile.mjs','player.mjs','participation.mjs','styles.css','shared.mjs','stories.mjs']]:
    if (root/source).read_bytes()!=(root/target).read_bytes(): errors.append('Stale build: '+target)
runtime=json.loads((dist/'catalogue.js').read_text().removeprefix('export default ').strip().removesuffix(';'))
story_index=[{**{k:s[k] for k in ['id','slug','title','description','category','published','artistIds','keywords']},'path':f"/stories/{s['slug']}/"} for s in stories]
if runtime!={**catalogue,'listeningGuides':[g for g in catalogue['listeningGuides'] if g.get('status')!='draft'],'media':media,'stories':story_index,'polls':[{'id':poll['id'],'path':f"/polls/{poll['id']}/"} for poll in public_polls]}: errors.append('Stale catalogue; run npm run build')
if json.loads((root/'.openai/hosting.json').read_text())['static']['directory']!='dist': errors.append('Unexpected static directory')
if errors: raise SystemExit('\n'.join(errors))
print(f'PASS: {len(pages)} static pages, local links and anchors, responsive assets, metadata, sitemap, deferred players and shared build data.')
print('Image usage rights remain unconfirmed; these checks do not authorize publication.')
