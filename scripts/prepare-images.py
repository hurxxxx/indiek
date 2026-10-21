"""Create display-size WebP variants and an original typographic sharing card.

Run only when image inputs change. Requires Pillow with WebP support.
The source images are retained without alteration.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'dist/assets'
OUT = ASSETS / 'optimized'
OUT.mkdir(exist_ok=True)
catalogue = json.loads((ROOT / 'content/catalogue.json').read_text())
portraits = {f['image'] for f in catalogue['featuredArtists'] if f.get('image')}
home = json.loads((ROOT / 'content/home.json').read_text())
home_features = [f for section in home['sections'] if section['type']=='discover' for f in section['features'] if f.get('image')]
portraits |= {f['image'] for f in home_features if f.get('kind')=='portrait'}
images = portraits | {r['image'] for r in catalogue['tracks']} | {f['image'] for f in home_features}
manifest = {}
for name in sorted(images):
    with Image.open(ASSETS / name) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
        widths = [480, 960, 1600] if name in portraits else [320, 640, 1000]
        widths = sorted({min(width, image.width) for width in widths})
        variants = []
        for width in widths:
            height = round(image.height * width / image.width)
            target = OUT / f'{Path(name).stem}-{width}.webp'
            image.resize((width, height), Image.Resampling.LANCZOS).save(target, 'WEBP', quality=85, method=6)
            variants.append({'src': '/assets/optimized/' + target.name, 'width': width, 'height': height, 'bytes': target.stat().st_size})
        manifest[name] = {'width': image.width, 'height': image.height, 'variants': variants}
(ROOT / 'content/media.json').write_text(json.dumps(manifest, indent=2) + '\n')

# Original brand graphic, using the project's OFL-licensed fonts; no artist images.
card = Image.new('RGB', (1200, 630), '#f5f3ed')
draw = ImageDraw.Draw(card)
ink, red = '#20211e', '#c83b26'
body = ImageFont.truetype(str(ASSETS / 'font-6.ttf'), 222)
display = ImageFont.truetype(str(ASSETS / 'font-0.ttf'), 76)
mono = ImageFont.truetype(str(ASSETS / 'font-7.ttf'), 19)
draw.line((60, 75, 1140, 75), fill=ink, width=2)
draw.text((60, 32), 'MUSIC FROM KOREA, WORTH SHARING', fill=ink, font=mono)
draw.text((62, 91), 'indiek', fill=ink, font=body)
width = draw.textlength('indiek', font=body)
draw.text((62 + width, 91), '.', fill=red, font=body)
draw.text((65, 365), 'Good music travels.', fill=ink, font=display)
draw.line((60, 535, 1140, 535), fill=ink, width=2)
draw.text((60, 563), 'A PERSONAL LISTENING JOURNAL', fill=ink, font=mono)
draw.text((1000, 563), 'INDIEK.COM', fill=ink, font=mono)
card.save(ASSETS / 'indiek-share.png', optimize=True)
print(f'Prepared {len(manifest)} image families and the 1200×630 sharing card.')
