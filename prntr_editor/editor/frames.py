"""Contact sheets: grab frames at given times with a labelled 0-1 grid, so pointers and zooms can be placed exactly."""
import os
from PIL import Image, ImageDraw
from .common import run
from .graphics import font


def grab(video, t, path, width=960):
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1", "-vf", f"scale={width}:-2", path])
    return path


def sheet(video, times, out, grid=True, cols=2, width=960):
    tiles = []
    for i, t in enumerate(times):
        p = grab(video, t, out + f".{i}.jpg", width)
        im = Image.open(p).convert("RGB"); os.remove(p)
        d = ImageDraw.Draw(im)
        if grid:
            for k in range(1, 10):
                x, y = im.width * k / 10, im.height * k / 10
                d.line([(x, 0), (x, im.height)], fill=(255, 255, 0), width=1)
                d.line([(0, y), (im.width, y)], fill=(255, 255, 0), width=1)
                d.text((x + 2, 2), f".{k}", fill=(255, 255, 0), font=font(14, False))
                d.text((2, y + 2), f".{k}", fill=(255, 255, 0), font=font(14, False))
        d.rectangle((0, im.height - 30, 180, im.height), fill=(0, 0, 0))
        d.text((6, im.height - 27), f"t = {t:.2f}s", fill=(255, 255, 255), font=font(20, False))
        tiles.append(im)
    w, h = tiles[0].size
    rows = (len(tiles) + cols - 1) // cols
    S = Image.new("RGB", (w * min(cols, len(tiles)), h * rows), (0, 0, 0))
    for i, im in enumerate(tiles):
        S.paste(im, ((i % cols) * w, (i // cols) * h))
    S.save(out, quality=88)
    return out
