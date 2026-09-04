"""Generate native splash assets from the transparent UKHUWAH MOBILE logo."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
STUDENT_RES = ROOT / "android" / "app" / "src" / "student" / "res"
TEACHER_RES = ROOT / "android" / "app" / "src" / "teacher" / "res"
FLUTTER_IMAGES = ROOT / "assets" / "images"
FLUTTER_BRANDING = ROOT / "assets" / "branding"

SOURCE = FLUTTER_BRANDING / "ukhuwah_splash_logo_source.png"
TRANSPARENT = (0, 0, 0, 0)
POWERED_TEXT = "Powered by iBaenk's"


def is_background_black(r: int, g: int, b: int, a: int) -> bool:
    if a < 16:
        return True
    luma = 0.299 * r + 0.587 * g + 0.114 * b
    chroma = max(r, g, b) - min(r, g, b)
    return luma <= 32 and chroma <= 22


def knock_out_black_background(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    pixels = im.load()
    width, height = im.size
    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def consider(x: int, y: int) -> None:
        idx = y * width + x
        if visited[idx]:
            return
        r, g, b, a = pixels[x, y]
        if not is_background_black(r, g, b, a):
            return
        visited[idx] = 1
        queue.append((x, y))

    for x in range(width):
        consider(x, 0)
        consider(x, height - 1)
    for y in range(height):
        consider(0, y)
        consider(width - 1, y)

    while queue:
        x, y = queue.popleft()
        pixels[x, y] = TRANSPARENT
        if x > 0:
            consider(x - 1, y)
        if x + 1 < width:
            consider(x + 1, y)
        if y > 0:
            consider(x, y - 1)
        if y + 1 < height:
            consider(x, y + 1)
    return im


def fit_square(im: Image.Image, size: int) -> Image.Image:
    im = im.convert("RGBA")
    canvas = Image.new("RGBA", (size, size), TRANSPARENT)
    scale = min(size / im.width, size / im.height)
    new_size = (max(1, int(im.width * scale)), max(1, int(im.height * scale)))
    resized = im.resize(new_size, Image.Resampling.LANCZOS)
    offset = ((size - new_size[0]) // 2, (size - new_size[1]) // 2)
    canvas.paste(resized, offset, resized)
    return canvas


def save_png(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG", optimize=True)


def font_path() -> str:
    for candidate in (
        r"C:\Windows\Fonts\segoeuisemibold.ttf",
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ):
        if Path(candidate).exists():
            return candidate
    return ""


def make_powered_by(width: int, height: int) -> Image.Image:
    canvas = Image.new("RGBA", (width, height), TRANSPARENT)
    draw = ImageDraw.Draw(canvas)
    size = max(18, int(height * 0.34))
    path = font_path()
    font = ImageFont.truetype(path, size) if path else ImageFont.load_default()
    bbox = draw.textbbox((0, 0), POWERED_TEXT, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    x = (width - text_w) / 2 - bbox[0]
    y = (height - text_h) / 2 - bbox[1]
    draw.text((x, y), POWERED_TEXT, font=font, fill=(90, 110, 92, 230))
    return canvas


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    source = knock_out_black_background(Image.open(SOURCE))
    splash = fit_square(source, 1024)
    save_png(splash, FLUTTER_IMAGES / "native_splash_logo.png")

    splash_sizes = {
        "drawable-mdpi": 192,
        "drawable-hdpi": 288,
        "drawable-xhdpi": 384,
        "drawable-xxhdpi": 576,
        "drawable-xxxhdpi": 768,
    }
    android12_icon_sizes = {
        "drawable-mdpi": 288,
        "drawable-hdpi": 432,
        "drawable-xhdpi": 576,
        "drawable-xxhdpi": 864,
        "drawable-xxxhdpi": 1152,
    }
    powered_sizes = {
        "drawable-mdpi": (200, 48),
        "drawable-hdpi": (300, 72),
        "drawable-xhdpi": (400, 96),
        "drawable-xxhdpi": (600, 144),
        "drawable-xxxhdpi": (800, 192),
    }

    for folder, size in splash_sizes.items():
        logo = fit_square(source, size)
        save_png(logo, ANDROID_RES / folder / "ukhuwah_splash_logo.png")
        save_png(logo, STUDENT_RES / folder / "ukhuwah_splash_logo.png")
        save_png(logo, TEACHER_RES / folder / "ukhuwah_splash_logo.png")

    for folder, size in android12_icon_sizes.items():
        canvas = Image.new("RGBA", (size, size), TRANSPARENT)
        inner = int(size * 0.72)
        logo = fit_square(source, inner)
        offset = ((size - inner) // 2, (size - inner) // 2)
        canvas.paste(logo, offset, logo)
        save_png(canvas, ANDROID_RES / folder / "ukhuwah_splash_icon.png")
        save_png(canvas, STUDENT_RES / folder / "ukhuwah_splash_icon.png")
        save_png(canvas, TEACHER_RES / folder / "ukhuwah_splash_icon.png")

    for folder, (width, height) in powered_sizes.items():
        banner = make_powered_by(width, height)
        save_png(banner, ANDROID_RES / folder / "ukhuwah_powered_by.png")
        save_png(banner, STUDENT_RES / folder / "ukhuwah_powered_by.png")
        save_png(banner, TEACHER_RES / folder / "ukhuwah_powered_by.png")

    print("Generated transparent UKHUWAH splash assets.")


if __name__ == "__main__":
    main()
