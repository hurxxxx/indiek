"""Render indiek's own commentary carousel slides (4:5 JPEG) from published lyric notes.

Input on stdin: {"fonts": "<dir with font-1.ttf/font-3.ttf>", "slides": [{"dest": path, ...}]}.
Only indiek's own text is drawn; no artist photographs or album artwork are used.
"""
import io
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H, M = 1080, 1350, 84
paper, ink, accent, muted = '#f5f3ed', '#21211e', '#ce4227', '#64635c'
spec = json.load(sys.stdin)
fonts = Path(spec['fonts'])


def font(size, display=False):
    return ImageFont.truetype(str(fonts / ('font-1.ttf' if display else 'font-3.ttf')), size)


def wrap(draw, text, f, width):
    lines = []
    for word in text.split():
        if lines and draw.textlength(lines[-1] + ' ' + word, font=f) <= width:
            lines[-1] += ' ' + word
        else:
            lines.append(word)
    return lines


def fit(draw, text, sizes, width, height, display=False, leading=1.42):
    for size in sizes:
        f = font(size, display)
        lines = wrap(draw, text, f, width)
        step = int(size * leading)
        if len(lines) * step <= height and all(draw.textlength(line, font=f) <= width for line in lines):
            return f, lines, step
    raise SystemExit(f'Slide text does not fit: {text[:60]}...')


def frame(slide):
    im = Image.new('RGB', (W, H), paper)
    d = ImageDraw.Draw(im)
    d.text((M - 4, 52), 'indiek.', font=font(64, True), fill=accent)
    counter = f"{slide['index']}/{slide['total']}"
    d.text((W - M - d.textlength(counter, font=font(26)), 78), counter, font=font(26), fill=muted)
    d.line((M, 150, W - M, 150), fill=ink, width=2)
    d.line((M, H - 128, W - M, H - 128), fill=ink, width=1)
    d.text((M, H - 100), slide['footer'], font=font(26), fill=muted)
    return im, d


def render(slide):
    im, d = frame(slide)
    if slide['kind'] == 'cover':
        d.text((M, 200), slide['label'].upper(), font=font(28), fill=accent)
        f, lines, step = fit(d, slide['title'], range(120, 59, -4), W - 2 * M, 430, True, 1.04)
        y = 250
        for line in lines:
            d.text((M - 3, y), line, font=f, fill=ink)
            y += step
        y += 26
        d.text((M, y), slide['artist'], font=font(44), fill=ink)
        y += 96
        d.line((M, y, M + 120, y), fill=accent, width=4)
        f, lines, step = fit(d, slide['heading'], range(64, 39, -2), W - 2 * M, H - 128 - 60 - (y + 40), True, 1.12)
        y += 40
        for line in lines:
            d.text((M - 2, y), line, font=f, fill=ink)
            y += step
    elif slide['kind'] == 'text':
        d.text((M, 200), slide['label'], font=font(28), fill=accent)
        f, lines, step = fit(d, slide['text'], range(50, 33, -1), W - 2 * M, H - 128 - 70 - 270)
        y = 270
        for line in lines:
            d.text((M, y), line, font=f, fill=ink)
            y += step
    else:
        d.text((M, 200), slide['label'].upper(), font=font(28), fill=accent)
        f, lines, step = fit(d, slide['text'], range(84, 47, -2), W - 2 * M, 520, True, 1.1)
        y = 300
        for line in lines:
            d.text((M - 2, y), line, font=f, fill=ink)
            y += step
        y += 60
        d.text((M, y), slide['url'], font=font(44), fill=accent)
    buffer = io.BytesIO()
    im.save(buffer, format='JPEG', quality=90, optimize=True, subsampling=0)
    return buffer.getvalue()


for slide in spec['slides']:
    dest = Path(slide['dest'])
    dest.parent.mkdir(parents=True, exist_ok=True)
    data = render(slide)
    # Stable bytes keep rebuilds from rewriting unchanged slides.
    if not dest.exists() or dest.read_bytes() != data:
        dest.write_bytes(data)
print(f"Rendered {len(spec['slides'])} commentary carousel slides.")
