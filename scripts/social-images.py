"""Render original typographic sharing cards; no third-party artwork is republished."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
entries = json.load(sys.stdin)
assets = root / 'dist/assets'
paper, ink, accent, muted = '#f5f3ed', '#21211e', '#ce4227', '#64635c'

def font(size, display=False):
    return ImageFont.truetype(str(assets / ('font-1.ttf' if display else 'font-3.ttf')), size)

def wrap(draw, text, f, width):
    lines = []
    for word in text.split():
        if lines and draw.textlength(lines[-1] + ' ' + word, font=f) <= width:
            lines[-1] += ' ' + word
        else:
            lines.append(word)
    return lines

for entry in entries:
    dest = root / 'dist' / entry['image'].lstrip('/')
    dest.parent.mkdir(parents=True, exist_ok=True)
    im = Image.new('RGB', (1200, 630), paper)
    d = ImageDraw.Draw(im)
    d.text((58, 35), 'indiek.', font=font(60, True), fill=accent)
    d.text((790, 65), 'MUSIC FROM KOREA', font=font(22), fill=muted)
    d.line((60, 127, 1140, 127), fill=ink, width=2)
    d.text((60, 158), entry['label'].upper(), font=font(22), fill=accent)
    for size in range(92, 39, -2):
        title_font = font(size, True)
        lines = wrap(d, entry['title'], title_font, 1060)
        if len(lines) * (size + 8) <= 290:
            break
    y = 202
    for line in lines:
        d.text((57, y), line, font=title_font, fill=ink)
        y += size + 8
    d.line((60, 525, 1140, 525), fill=ink, width=1)
    subtitle = entry['subtitle']
    if d.textlength(subtitle, font=font(24)) > 900:
        subtitle = entry['label'] + ' / indiek.com'
    d.text((60, 551), subtitle, font=font(24), fill=muted)
    d.text((1075, 545), 'ik.', font=font(40, True), fill=accent)
    # Stable bytes keep rebuilds from rewriting unchanged generated assets.
    import io
    buffer = io.BytesIO()
    im.save(buffer, format='JPEG', quality=91, optimize=True, subsampling=0)
    data = buffer.getvalue()
    if not dest.exists() or dest.read_bytes() != data:
        dest.write_bytes(data)
print(f'Rendered {len(entries)} original sharing cards.')
