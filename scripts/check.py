"""Check the static deliverable's local links and template invariants."""
from html.parser import HTMLParser
from pathlib import Path
import json
import re

root = Path(__file__).resolve().parents[1]
dist = root / 'dist'
errors = []
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.refs=[]; self.ids=set()
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if 'id' in a:
            if a['id'] in self.ids: errors.append('Duplicate id: '+a['id'])
            self.ids.add(a['id'])
        for key in ('href','src'):
            if key in a:self.refs.append(a[key])
        if tag=='img' and 'alt' not in a:errors.append('Image missing alt text')
for path in dist.glob('*.html'):
    page=Page();page.feed(path.read_text())
    for ref in page.refs:
        if ref.startswith(('http:','https:','data:','mailto:')):continue
        if ref.startswith('#'):
            if ref[1:] not in page.ids:errors.append(f'{path.name}: missing anchor {ref}')
        elif not (path.parent/ref.split('#')[0]).exists():errors.append(f'{path.name}: missing file {ref}')
for name in re.findall(r"(?:image|src):?'?\s*'([^']+\.(?:jpg|woff2|ttf))'",(dist/'app.js').read_text()):
    if not (dist/'assets'/name).exists():errors.append('Missing JS asset: '+name)
for ref in re.findall(r'url\(([^)]+)\)',(dist/'assets/fonts.css').read_text()):
    if not (dist/'assets'/ref).exists():errors.append('Missing font: '+ref)
assert json.loads((root/'.openai/hosting.json').read_text())['static']['directory']=='dist'
if errors:raise SystemExit('\n'.join(errors))
print('PASS: local assets, page links, anchors, unique IDs, image alt text and static hosting manifest.')
