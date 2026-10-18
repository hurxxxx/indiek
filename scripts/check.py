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
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
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
expected_count=len(catalogue['records'])+5
if len(pages)!=expected_count: errors.append(f'Expected {expected_count} pages, found {len(pages)}')
if site['url']+'/sitemap.xml' not in (dist/'robots.txt').read_text(): errors.append('Missing robots sitemap')
for source,target in [('site/app.js','dist/app.js'),('site/styles.css','dist/styles.css'),('site/shared.mjs','dist/shared.mjs')]:
    if (root/source).read_bytes()!=(root/target).read_bytes(): errors.append('Stale build: '+target)
runtime=json.loads((dist/'catalogue.js').read_text().removeprefix('export default ').strip().removesuffix(';'))
if runtime!={**catalogue,'media':media}: errors.append('Stale catalogue; run npm run build')
if json.loads((root/'.openai/hosting.json').read_text())['static']['directory']!='dist': errors.append('Unexpected static directory')
if errors: raise SystemExit('\n'.join(errors))
print(f'PASS: {len(pages)} static pages, local links and anchors, responsive assets, metadata, sitemap, deferred players and shared build data.')
print('Image usage rights remain unconfirmed; these checks do not authorize publication.')
