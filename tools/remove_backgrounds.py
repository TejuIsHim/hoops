import argparse
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image

try:
    from rembg import new_session, remove
except ImportError:
    sys.exit('rembg is not installed. Run: pip install "rembg[cpu]" pillow numpy')

SOURCE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".avif"}
PHOTO_MAX = 512
WORK_MAX = 640
QUALITY = 85
ALWAYS_SKIP = ("2026-spain",)


def has_background(img, only_jpg, path):
    if only_jpg and path.suffix.lower() not in (".jpg", ".jpeg"):
        return False
    if img.mode in ("RGBA", "LA", "PA") or "transparency" in img.info:
        alpha = img.convert("RGBA").getchannel("A")
        return alpha.getextrema()[0] == 255
    return True


def background_colour(rgb):
    h, w, _ = rgb.shape
    k = max(2, min(h, w) // 40)
    corners = np.concatenate([
        rgb[:k, :k].reshape(-1, 3), rgb[:k, -k:].reshape(-1, 3),
        rgb[-k:, :k].reshape(-1, 3), rgb[-k:, -k:].reshape(-1, 3),
    ])
    return np.median(corners, axis=0)


def defringe(cut, bg):
    data = np.asarray(cut).astype(np.float32)
    rgb, alpha = data[..., :3], data[..., 3:4] / 255.0
    edge = (alpha > 0.02) & (alpha < 0.98)
    safe = np.clip(alpha, 0.02, 1.0)
    cleaned = np.clip((rgb - (1.0 - safe) * bg) / safe, 0, 255)
    rgb = np.where(edge, cleaned, rgb)
    out = np.concatenate([rgb, data[..., 3:4]], axis=-1).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def process(path, session, backup_root, dry_run):
    with Image.open(path) as src:
        rgb_img = src.convert("RGB")
    if max(rgb_img.size) > WORK_MAX:
        rgb_img.thumbnail((WORK_MAX, WORK_MAX), Image.LANCZOS)
    bg = background_colour(np.asarray(rgb_img).astype(np.float32))
    if dry_run:
        print(f"would process {path}")
        return
    try:
        cut = remove(
            rgb_img,
            session=session,
            post_process_mask=True,
            alpha_matting=True,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=10,
        )
    except MemoryError:
        print(f"note  {path}: not enough memory for fine edges, using standard edges")
        cut = remove(rgb_img, session=session, post_process_mask=True)
    cut = defringe(cut.convert("RGBA"), bg)
    if max(cut.size) > PHOTO_MAX:
        cut.thumbnail((PHOTO_MAX, PHOTO_MAX), Image.LANCZOS)
    if backup_root is not None:
        dest = backup_root / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
    target = path.with_name(path.stem.lower() + ".webp")
    tmp = target.with_name(target.stem + ".tmp.webp")
    cut.save(tmp, "WEBP", quality=QUALITY, method=6)
    if path != target and path.exists():
        path.unlink()
    tmp.replace(target)
    print(f"done  {target}")


def main():
    parser = argparse.ArgumentParser(description="Remove solid backgrounds from player photos.")
    parser.add_argument("root", nargs="?", default="assets/teams", help="folder to scan (default: assets/teams)")
    parser.add_argument("--only-jpg", action="store_true", help="only touch .jpg/.jpeg files")
    parser.add_argument("--dry-run", action="store_true", help="list the photos that would change, change nothing")
    parser.add_argument("--no-backup", action="store_true", help="do not copy originals to bg-backup/")
    parser.add_argument("--model", default="u2net_human_seg", help="rembg model (default: u2net_human_seg)")
    parser.add_argument("--skip", action="append", default=[], metavar="NAME", help="also skip any folder with this name (repeatable); folders in ALWAYS_SKIP are always skipped")
    args = parser.parse_args()

    root = Path(args.root)
    if not root.exists():
        sys.exit(f"{root} not found. Run this from the root of the site.")

    skip = {name.lower() for name in list(ALWAYS_SKIP) + args.skip}
    todo = []
    skipped = 0
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.parent.name != "players" or path.suffix.lower() not in SOURCE_EXTS or ".tmp." in path.name:
            continue
        if any(part.lower() in skip for part in path.resolve().parts):
            skipped += 1
            continue
        with Image.open(path) as img:
            if has_background(img, args.only_jpg, path):
                todo.append(path)

    if skipped:
        print(f"Left {skipped} photo(s) untouched in protected folders: {', '.join(sorted(skip))}")
    if not todo:
        print("No photos with a solid background found.")
        return
    print(f"{len(todo)} photo(s) with a solid background.")

    session = None if args.dry_run else new_session(args.model)
    backup_root = None if (args.no_backup or args.dry_run) else Path("bg-backup")
    for path in todo:
        try:
            process(path, session, backup_root, args.dry_run)
        except Exception as error:
            print(f"FAILED {path}: {error}")
    if backup_root is not None:
        print("Originals copied to bg-backup/. Delete that folder once you're happy (don't commit it).")


if __name__ == "__main__":
    main()