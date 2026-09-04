"""Generate Android launcher, splash, and Flutter branding assets from the UKHUWAH MOBILE icon."""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.stderr.write("Pillow is required. Installing is handled by the caller.\n")
    raise

ROOT = Path(__file__).resolve().parents[1]
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
STUDENT_RES = ROOT / "android" / "app" / "src" / "student" / "res"
TEACHER_RES = ROOT / "android" / "app" / "src" / "teacher" / "res"
FLUTTER_BRANDING = ROOT / "assets" / "branding"
FLUTTER_IMAGES = ROOT / "assets" / "images"

SOURCE_CANDIDATES = [
    FLUTTER_BRANDING / "ukhuwah_mobile_icon_source.jpg",
    FLUTTER_BRANDING / "ukhuwah_mobile_icon_source.png",
]


def find_source() -> Path:
    for path in SOURCE_CANDIDATES:
        if path.exists():
            return path
    raise FileNotFoundError("UKHUWAH icon source not found in assets/branding")


def fit_square(im: Image.Image, size: int, background=(255, 255, 255, 255)) -> Image.Image:
    im = im.convert("RGBA")
    canvas = Image.new("RGBA", (size, size), background)
    scale = min(size / im.width, size / im.height)
    new_size = (max(1, int(im.width * scale)), max(1, int(im.height * scale)))
    resized = im.resize(new_size, Image.Resampling.LANCZOS)
    offset = ((size - new_size[0]) // 2, (size - new_size[1]) // 2)
    canvas.paste(resized, offset, resized)
    return canvas


def save_png(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "PNG", optimize=True)


def main() -> None:
    source = Image.open(find_source())
    master = fit_square(source, 1024, (255, 255, 255, 255))
    splash = fit_square(source, 1024, (255, 255, 255, 0))

    save_png(master, FLUTTER_BRANDING / "ukhuwah_mobile_icon.png")
    save_png(master, FLUTTER_IMAGES / "app_launcher_icon.png")
    save_png(splash, FLUTTER_IMAGES / "native_splash_logo.png")

    launcher_sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    foreground_sizes = {
        "mipmap-mdpi": 108,
        "mipmap-hdpi": 162,
        "mipmap-xhdpi": 216,
        "mipmap-xxhdpi": 324,
        "mipmap-xxxhdpi": 432,
    }
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

    for folder, size in launcher_sizes.items():
        icon = fit_square(source, size)
        save_png(icon, ANDROID_RES / folder / "ic_launcher.png")
        save_png(icon, ANDROID_RES / folder / "ic_launcher_round.png")
        save_png(icon, TEACHER_RES / folder / "ic_launcher.png")
        save_png(icon, TEACHER_RES / folder / "ic_launcher_round.png")

    for folder, size in foreground_sizes.items():
        padded = Image.new("RGBA", (size, size), (255, 255, 255, 255))
        inner = int(size * 0.72)
        logo = fit_square(source, inner)
        offset = ((size - inner) // 2, (size - inner) // 2)
        padded.paste(logo, offset, logo)
        save_png(padded, ANDROID_RES / folder / "ic_launcher_foreground.png")
        save_png(padded, TEACHER_RES / folder / "ic_launcher_foreground.png")

    for folder, size in splash_sizes.items():
        logo = fit_square(source, size, (255, 255, 255, 0))
        save_png(logo, ANDROID_RES / folder / "ukhuwah_splash_logo.png")
        save_png(logo, STUDENT_RES / folder / "ukhuwah_splash_logo.png")
        save_png(logo, TEACHER_RES / folder / "ukhuwah_splash_logo.png")

    for folder, size in android12_icon_sizes.items():
        canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
        inner = int(size * 0.62)
        logo = fit_square(source, inner, (255, 255, 255, 0))
        offset = ((size - inner) // 2, (size - inner) // 2)
        canvas.paste(logo, offset, logo)
        save_png(canvas, ANDROID_RES / folder / "ukhuwah_splash_icon.png")
        save_png(canvas, STUDENT_RES / folder / "ukhuwah_splash_icon.png")
        save_png(canvas, TEACHER_RES / folder / "ukhuwah_splash_icon.png")

    print("Generated UKHUWAH Android branding assets.")


if __name__ == "__main__":
    main()
