from PIL import Image
from pathlib import Path

BRANDING = Path(r"G:\assets\branding")
FULL_OUT = BRANDING / "genpro_logo_full.png"
RAYS_OUT = BRANDING / "genpro_rays.png"
SMILE_OUT = BRANDING / "genpro_smile.png"
WORDMARK_OUT = BRANDING / "genpro_wordmark.png"
ORIG = Path(r"O:\c__Users_Baenk_s_AppData_Roaming_Cursor_User_workspaceStorage_3145c86c0dbb62be521f9af67ebefa9a_images_Logo_GenPro_lengkap-51c02e60-2837-42d0-8edb-e0e4f7355d8b.png")
TARGET_W = 1024

def content_bbox(im, alpha_thresh=8):
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    a = im.split()[-1]
    mask = a.point(lambda p: 255 if p > alpha_thresh else 0)
    return mask.getbbox()

def is_near_black(r, g, b, a, lim=40):
    return a > 8 and r <= lim and g <= lim and b <= lim

def is_yellow_ray(r, g, b, a):
    if a < 20:
        return False
    return r >= 180 and g >= 140 and b <= 120 and (r + g) > (b * 3) and r >= g - 20

def remove_black_to_transparent(im):
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_near_black(r, g, b, a):
                px[x, y] = (0, 0, 0, 0)
    return im

def resize_width(im, width):
    w, h = im.size
    if w == width:
        return im
    nh = max(1, round(h * (width / w)))
    return im.resize((width, nh), Image.Resampling.LANCZOS)

def robust_left_baseline(full, x_frac=0.55, min_count=30):
    w, h = full.size
    px = full.load()
    x_lim = int(w * x_frac)
    baseline = 0
    for y in range(h):
        cnt = 0
        for x in range(x_lim):
            r, g, b, a = px[x, y]
            if a < 20:
                continue
            if is_yellow_ray(r, g, b, a):
                continue
            cnt += 1
        if cnt >= min_count:
            baseline = y
    return baseline

def main():
    BRANDING.mkdir(parents=True, exist_ok=True)
    src = Image.open(ORIG if ORIG.exists() else FULL_OUT).convert("RGBA")
    print("Using:", ORIG if ORIG.exists() else FULL_OUT)

    full = remove_black_to_transparent(src)
    full = resize_width(full, TARGET_W)
    full.save(FULL_OUT, "PNG")
    print("Saved full size=", full.size, "bbox=", content_bbox(full))

    w, h = full.size
    px = full.load()
    baseline = robust_left_baseline(full)
    smile_x0 = int(w * 0.55)
    smile_y0 = max(int(h * 0.55), baseline + 1)
    print("baseline=", baseline, "smile x>=", smile_x0, "y>=", smile_y0)

    rays = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    smile = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    wordmark = full.copy()
    rpx, spx, wpx = rays.load(), smile.load(), wordmark.load()

    ray_count = smile_count = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 8:
                continue
            if is_yellow_ray(r, g, b, a):
                rpx[x, y] = (r, g, b, a)
                wpx[x, y] = (0, 0, 0, 0)
                ray_count += 1
                continue
            if x >= smile_x0 and y >= smile_y0:
                blueish = b >= 40 and b >= r and (b > r + 5 or g > r)
                dark_aa = (r + g + b) < 220 and b >= r
                if blueish or dark_aa:
                    spx[x, y] = (r, g, b, a)
                    wpx[x, y] = (0, 0, 0, 0)
                    smile_count += 1

    # Drop neutral gray speckles below letter baseline (not letter ink)
    cleaned = 0
    for y in range(baseline + 1, h):
        for x in range(w):
            r, g, b, a = wpx[x, y]
            if a < 8:
                continue
            mx = max(r, g, b)
            mn = min(r, g, b)
            if mx - mn <= 12 and mx < 90:
                wpx[x, y] = (0, 0, 0, 0)
                cleaned += 1
    print("cleaned gray speckles below baseline:", cleaned)

    rays.save(RAYS_OUT, "PNG")
    smile.save(SMILE_OUT, "PNG")
    wordmark.save(WORDMARK_OUT, "PNG")

    bb_w = content_bbox(wordmark)
    bb_s = content_bbox(smile)
    bb_r = content_bbox(rays)
    bb_f = content_bbox(full)
    print("--- RESULTS ---")
    print("full bbox:    ", bb_f)
    print("rays bbox:    ", bb_r, "pixels=", ray_count)
    print("smile bbox:   ", bb_s, "pixels=", smile_count)
    print("wordmark bbox:", bb_w)

    mid_y = int(round(h * (200 / 368.0)))
    samples = []
    for label, y_check in [
        ("mid~200scaled", mid_y),
        ("mid48pct", int(h * 0.48)),
        ("letter_lower", max(0, baseline - 20)),
        ("letter_bottom", baseline),
    ]:
        n = sum(1 for x in range(w) if wpx[x, y_check][3] > 20)
        samples.append((label, y_check, n))
        print("wordmark opaque @ y=%d (%s): %d" % (y_check, label, n))

    # Right letter bottoms intact?
    right_ok = sum(
        1
        for y in range(baseline - 30, baseline + 1)
        for x in range(smile_x0, w)
        if wpx[x, y][3] > 20
    )
    print("right letter-bottom opaque count:", right_ok)

    delta = abs(bb_w[3] - baseline) if bb_w else 999
    print("wordmark.bottom - baseline =", (bb_w[3] - baseline) if bb_w else None)
    letters_complete = (
        samples[0][2] > 50
        and samples[1][2] > 50
        and samples[2][2] > 30
        and samples[3][2] > 20
        and delta <= 5
        and right_ok > 200
        and bb_s is not None
        and bb_s[1] > baseline
    )
    print("LETTERS_COMPLETE=%s" % letters_complete)
    print("Done. Overwrote files in", BRANDING)

if __name__ == "__main__":
    main()
