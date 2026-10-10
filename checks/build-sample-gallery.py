"""Archive original sample photos and build their local visual catalogue.

Run with Pillow available: python checks/build-sample-gallery.py
Originals retain their ZIP bytes. Thumbnails and contact sheets are derived views.
"""
from pathlib import Path, PurePosixPath
from zipfile import ZipFile
from PIL import Image, ImageOps, ImageDraw, ImageFont
import hashlib
import html
import json
import math
import stat

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'aespa.zip'
LIBRARY = ROOT / 'samples' / 'aespa'
ORIGINALS = LIBRARY / 'originals'
THUMBS = LIBRARY / 'thumbs'
MANIFEST = LIBRARY / 'manifest.json'
sha256 = lambda data: hashlib.sha256(data).hexdigest()
previous = json.loads(MANIFEST.read_text(encoding='utf-8')) if MANIFEST.exists() else {}
known = {item['sha256']: item for item in previous.get('images', [])}
ORIGINALS.mkdir(parents=True, exist_ok=True)
THUMBS.mkdir(parents=True, exist_ok=True)
entries = []

with ZipFile(ARCHIVE) as package:
    members = [member for member in package.infolist() if not member.is_dir()]
    # Validate all destinations before writing any archive member.
    for member in members:
        relative = PurePosixPath(member.filename.replace('\\', '/'))
        destination = (ORIGINALS / Path(*relative.parts)).resolve()
        mode = member.external_attr >> 16
        if relative.is_absolute() or '..' in relative.parts or ':' in member.filename or stat.S_ISLNK(mode):
            raise ValueError(f'Unsupported archive path: {member.filename}')
        if not destination.is_relative_to(ORIGINALS.resolve()):
            raise ValueError(f'Archive path escapes the library: {member.filename}')
        if destination.suffix.lower() not in {'.jpg', '.jpeg', '.png', '.webp'}:
            raise ValueError(f'Unexpected non-photo archive member: {member.filename}')
    for position, member in enumerate(members, 1):
        relative = PurePosixPath(member.filename.replace('\\', '/'))
        destination = ORIGINALS / Path(*relative.parts)
        data = package.read(member)
        if destination.exists() and destination.read_bytes() != data:
            raise ValueError(f'Existing original differs from archive: {member.filename}')
        if not destination.exists():
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
        checksum = sha256(data)
        with Image.open(destination) as source:
            source.load()
            upright = ImageOps.exif_transpose(source).convert('RGB')
            width, height = upright.size
            thumb = upright.copy()
            thumb.thumbnail((420, 420), Image.Resampling.LANCZOS)
            sample_id = f'aespa-{position:02}'
            thumbnail_path = THUMBS / f'{sample_id}.jpg'
            thumb.save(thumbnail_path, quality=90)
        old = known.get(checksum, {})
        entries.append({
            'id': sample_id, 'filename': member.filename,
            'original': destination.relative_to(LIBRARY).as_posix(),
            'thumbnail': thumbnail_path.relative_to(LIBRARY).as_posix(),
            'width': width, 'height': height, 'bytes': len(data), 'sha256': checksum,
            'description': old.get('description', ''), 'tags': old.get('tags', [])
        })

manifest = {
    'name': 'aespa 示例图库', 'createdAt': '2026-10-05',
    'sourceArchive': ARCHIVE.name, 'archiveSha256': sha256(ARCHIVE.read_bytes()),
    'count': len(entries), 'images': entries,
    'testSets': previous.get('testSets', {}),
}
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

font_path = Path('C:/Windows/Fonts/msyh.ttc')
font = ImageFont.truetype(str(font_path), 18) if font_path.exists() else ImageFont.load_default()
small = ImageFont.truetype(str(font_path), 14) if font_path.exists() else ImageFont.load_default()
sheets = []
for page, start in enumerate(range(0, len(entries), 12), 1):
    subset = entries[start:start + 12]
    sheet = Image.new('RGB', (1120, 72 + math.ceil(len(subset) / 4) * 330), '#111713')
    draw = ImageDraw.Draw(sheet)
    draw.text((22, 20), f'AESPA SAMPLE LIBRARY  /  {page:02}  /  {len(entries)} PHOTOS', font=font, fill='#c8ff37')
    for index, item in enumerate(subset):
        x, y = (index % 4) * 280 + 12, 72 + (index // 4) * 330
        draw.rounded_rectangle((x, y, x + 256, y + 318), radius=8, fill='#202a23')
        with Image.open(LIBRARY / item['thumbnail']) as image:
            preview = ImageOps.contain(image, (246, 244), Image.Resampling.LANCZOS)
            sheet.paste(preview, (x + (256 - preview.width) // 2, y + 8 + (244 - preview.height) // 2))
        draw.text((x + 10, y + 258), f"{item['id'].upper()}  {item['width']} × {item['height']}", font=font, fill='white')
        label = item['description'][:16] or Path(item['filename']).stem[:22]
        draw.text((x + 10, y + 287), label, font=small, fill='#b8c5ba')
    name = f'contact-sheet-{page:02}.jpg'
    sheet.save(LIBRARY / name, quality=92)
    sheets.append(name)

cards = []
for item in entries:
    description = html.escape(item['description'] or f"样本 {item['id'][-2:]}")
    tags = ''.join(f'<span>{html.escape(tag)}</span>' for tag in item['tags'])
    cards.append(f'''<article><a class="preview" href="{html.escape(item['original'])}" target="_blank" rel="noopener"><img src="{html.escape(item['thumbnail'])}" alt="{description}" loading="lazy"></a><div class="caption"><p class="id">{item['id'].upper()} · {item['width']} × {item['height']}</p><h2>{description}</h2><div class="tags">{tags}</div><p class="filename">{html.escape(item['filename'])}</p><a class="original" href="{html.escape(item['original'])}" target="_blank" rel="noopener">查看原图 ↗</a></div></article>''')
page = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Aespa 示例图库 · Yongyong Visual Lab</title><style>
*{box-sizing:border-box}body{margin:0;background:#111713;color:#f3f5f0;font-family:Arial,"Microsoft YaHei",sans-serif}header{padding:34px max(24px,calc((100vw - 1240px)/2));border-bottom:1px solid #3d4c40}p{line-height:1.65}.eyebrow{color:#c8ff37;font-size:12px;letter-spacing:2px}h1{font-size:clamp(28px,4vw,48px);margin:8px 0}header p{color:#b8c5ba;margin:12px 0 0;max-width:900px}.meta{display:flex;gap:12px;flex-wrap:wrap;margin-top:22px}.meta span,.meta a{border:1px solid #536646;padding:8px 13px;font-size:12px;color:#c8ff37;text-decoration:none}main{max-width:1290px;margin:auto;padding:28px 24px 48px;display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:20px}article{border:1px solid #334038;background:#202a23;border-radius:8px;overflow:hidden}.preview{height:290px;background:#0c100d;display:flex;justify-content:center;align-items:center}.preview img{max-width:100%;max-height:100%;object-fit:contain}.caption{padding:16px}.id{font:11px monospace;color:#c8ff37;margin:0}h2{font-size:16px;margin:10px 0}.tags{display:flex;gap:5px;flex-wrap:wrap}.tags span{font-size:11px;background:#344538;color:#d3decf;padding:3px 7px}.filename{font:10px monospace;color:#9caf9e;overflow-wrap:anywhere}.original{font-size:12px;color:#c8ff37;text-decoration:none}footer{max-width:1240px;margin:auto;padding:0 24px 40px;color:#9caf9e;font-size:12px}
</style><header><div class="eyebrow">YONGYONG VISUAL LAB / SAMPLE LIBRARY</div><h1>Aespa 示例图库</h1><p>固定素材用于检查不同取景、光线、背景与服装下的模板效果。原图保持上传压缩包中的字节，缩略图用于浏览。</p><div class="meta"><span>__COUNT__ 张图片</span><span>2026-10-05</span><a href="manifest.json" target="_blank">素材清单 ↗</a><a href="../../index.html#poster" target="_blank" rel="noopener">打开海报编辑器 ↗</a></div></header><main>__CARDS__</main><footer>新模板按相同图库检查单图、多图、总 REMIX 素材保留、裁切、滤镜和导出。验证记录与效果对照另行保存。</footer></html>'''
(LIBRARY / 'index.html').write_text(page.replace('__COUNT__', str(len(entries))).replace('__CARDS__', '\n'.join(cards)), encoding='utf-8')
print(json.dumps({'count': len(entries), 'library': str(LIBRARY), 'sheets': sheets,
                  'dimensions': [{'id': e['id'], 'width':e['width'], 'height':e['height']} for e in entries]}, ensure_ascii=False))
