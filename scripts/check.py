"""Check every generated page, local navigation, metadata and catalogue asset."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import json
import re
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
catalogue = json.loads((root / 'content/catalogue.json').read_text())
site = catalogue['site']
errors = []

class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(); self.path=path; self.refs=[]; self.ids=set(); self.meta={}; self.canonical=[]; self.h1=0; self.frames=0
        self.guide_cards=[]; self.guide_tracks=[]; self.guide_id=None
        self.room_tracks=[]; self.room_count=None
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'data-room-count' in a: self.room_count=int(a['data-room-count'])
        if 'data-room-track' in a: self.room_tracks.append((a['data-room-track'],a.get('href')))
        if 'data-guide' in a: self.guide_cards.append((a['data-guide'],int(a['data-track-count'])))
        if 'data-guide-track' in a: self.guide_tracks.append((a['data-guide-track'],a.get('href')))
        if 'data-guide-page' in a: self.guide_id=a['data-guide-page']
        if 'id' in a:
            if a['id'] in self.ids: errors.append(f'{self.path}: duplicate id {a["id"]}')
            self.ids.add(a['id'])
        for key in ('href','src','data-src'):
            if a.get(key): self.refs.append(a[key])
        for key in ('srcset','data-srcset'):
            if a.get(key): self.refs.extend(item.strip().split()[0] for item in a[key].split(','))
        if tag=='img':
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
    if page.meta.get('og:image')!=site['url']+'/assets/indiek-share.png': errors.append(f'{path}: invalid sharing image')
    if page.h1!=1: errors.append(f'{path}: expected one h1')
    if 'analytics-notice' not in page.ids: errors.append(f'{path}: missing analytics choice')
    if any('matomo.lumejs.com' in ref for ref in page.refs): errors.append(f'{path}: Matomo loaded before consent')
    if page.frames: errors.append(f'{path}: player loaded without consent')
    if '{{' in text or 'lumejs.chatgpt.site' in text or 'data-story=' in text: errors.append(f'{path}: stale template content')
    for required in ['/about/','/privacy-and-terms/','mailto:'+site['email']]:
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
for record in catalogue['records']+[catalogue['editorPick']]:
    if 'hero-'+record['id'] not in pages[(dist/'index.html').resolve()].ids: errors.append('Missing hero artist: '+record['id'])
    if record['image'] not in media or record['image'] not in credits: errors.append('Missing image metadata: '+record['id'])
    target=(dist/'artists'/record['id']/'index.html').resolve()
    if target not in pages: errors.append('Missing artist page: '+record['id'])
    else:
        text=target.read_text()
        if record['videoId'] not in text: errors.append('Missing direct video link: '+record['id'])
        if record.get('externalOnly') and 'data-load-player=' in text: errors.append('External-only performance has an embed: '+record['id'])
for name, image in media.items():
    for variant in image['variants']:
        if not (dist/variant['src'].lstrip('/')).is_file(): errors.append('Missing variant: '+name)

urls={node.text for node in ET.parse(dist/'sitemap.xml').findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')}
if urls!={p.canonical[0] for p in pages.values()}: errors.append('Sitemap does not match generated pages')
home=pages[(dist/'index.html').resolve()]
expected_room=[(r['id'],f"/artists/{r['id']}/#listen") for r in catalogue['records']+[catalogue['editorPick']]]
if home.room_tracks!=expected_room: errors.append('Listening room does not match the complete catalogue')
if home.room_count!=len(expected_room): errors.append('Listening room count does not match its tracks')
if 'undefined' in (dist/'index.html').read_text(): errors.append('Undefined content on the homepage')
guide_ids=[g['id'] for g in catalogue['listeningGuides']]
guide_counts={}
covered=set()
for id in guide_ids:
    guide_page=pages.get((dist/'notes'/id/'index.html').resolve())
    if not guide_page:
        errors.append('Missing listening guide: '+id); continue
    if guide_page.guide_id!=id: errors.append('Wrong guide identity: '+id)
    members=[r for r,href in guide_page.guide_tracks]
    guide_counts[id]=len(members)
    covered.update(members)
    if not members or len(members)!=len(set(members)): errors.append('Empty or duplicate guide tracks: '+id)
    for record_id,href in guide_page.guide_tracks:
        if href!=f'/artists/{record_id}/#listen': errors.append('Wrong guide listening link: '+id)
if covered!={r['id'] for r in catalogue['records']+[catalogue['editorPick']]}: errors.append('Listening guides do not cover the catalogue')
for file in ['index.html','notes/first-listens/index.html']:
    index=pages.get((dist/file).resolve())
    if not index or index.guide_cards!=[(id,guide_counts.get(id)) for id in guide_ids]: errors.append('Guide cards disagree with guide pages: '+file)
    elif any(f'/notes/{id}/' not in index.refs for id in guide_ids): errors.append('Guide card link missing: '+file)
expected_count=len(catalogue['records'])+5+len(guide_ids)
if len(pages)!=expected_count: errors.append(f'Expected {expected_count} pages, found {len(pages)}')
if site['url']+'/sitemap.xml' not in (dist/'robots.txt').read_text(): errors.append('Missing robots sitemap')
for source,target in [('site/app.js','dist/app.js'),('site/analytics.mjs','dist/analytics.mjs'),('site/styles.css','dist/styles.css'),('site/shared.mjs','dist/shared.mjs')]:
    if (root/source).read_bytes()!=(root/target).read_bytes(): errors.append('Stale build: '+target)
runtime=json.loads((dist/'catalogue.js').read_text().removeprefix('export default ').strip().removesuffix(';'))
if runtime!={**catalogue,'media':media}: errors.append('Stale catalogue; run npm run build')
if json.loads((root/'.openai/hosting.json').read_text())['static']['directory']!='dist': errors.append('Unexpected static directory')
if errors: raise SystemExit('\n'.join(errors))
print(f'PASS: {len(pages)} static pages, local links and anchors, responsive assets, metadata, sitemap, deferred players and shared build data.')
print('Image usage rights remain unconfirmed; these checks do not authorize publication.')
