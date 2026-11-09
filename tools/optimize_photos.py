import os
import shutil
import stat
import sys
import time
from pathlib import Path

from PIL import Image

PHOTO_MAX = 512
CREST_MAX = 256
PHOTO_QUALITY = 82
WEBP_METHOD = 4
SOURCE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".avif"}


def shrink(img, limit):
    if max(img.size) > limit:
        img = img.copy()
        img.thumbnail((limit, limit), Image.LANCZOS)
    return img


class FileBusy(Exception):
    pass


def make_writable(path):
    try:
        if path.exists():
            os.chmod(path, stat.S_IWRITE | stat.S_IREAD)
    except OSError:
        pass


def swap_in(tmp, target, original):
    make_writable(target)
    make_writable(original)
    last = None
    for attempt in range(4):
        try:
            if original != target and original.exists():
                original.unlink()
            tmp.replace(target)
            return
        except PermissionError as error:
            last = error
            time.sleep(0.4 * (attempt + 1))
    try:
        shutil.copyfile(tmp, target)
        if original != target and original.exists():
            original.unlink()
        tmp.unlink()
        return
    except OSError as error:
        last = error
    try:
        tmp.unlink()
    except OSError:
        pass
    raise FileBusy(str(last))


def photo_reason(path):
    if path.suffix != ".webp":
        return path.suffix + " to .webp"
    if path.stem != path.stem.lower():
        return "uppercase name"
    with Image.open(path) as src:
        return f"{max(src.size)}px, shrinking to {PHOTO_MAX}"


def crest_reason(path):
    if path.suffix.lower() not in (".png", ".svg"):
        return path.suffix + " to .png"
    with Image.open(path) as src:
        return f"{max(src.size)}px, shrinking to {CREST_MAX}"


def photo_done(path):
    if path.suffix != ".webp" or path.stem != path.stem.lower():
        return False
    with Image.open(path) as src:
        return max(src.size) <= PHOTO_MAX


def crest_done(path):
    if path.stem != path.stem.lower():
        return False
    if path.suffix.lower() not in (".png", ".svg"):
        return False
    if path.suffix.lower() == ".svg":
        return True
    with Image.open(path) as src:
        return max(src.size) <= CREST_MAX


def optimize_photo(path):
    before = path.stat().st_size
    with Image.open(path) as src:
        img = src.convert("RGBA") if src.mode in ("P", "LA", "RGBA") or "transparency" in src.info else src.convert("RGB")
        img = shrink(img, PHOTO_MAX)
    target = path.with_name(path.stem.lower() + ".webp")
    tmp = target.with_suffix(".tmp.webp")
    img.save(tmp, "WEBP", quality=PHOTO_QUALITY, method=WEBP_METHOD)
    swap_in(tmp, target, path)
    return before, target.stat().st_size


def optimize_crest(path):
    before = path.stat().st_size
    with Image.open(path) as src:
        img = shrink(src.convert("RGBA"), CREST_MAX)
    target = path.with_name(path.stem.lower() + ".png")
    tmp = path.with_name(path.stem.lower() + ".tmp.png")
    img.save(tmp, "PNG", optimize=True)
    swap_in(tmp, target, path)
    return before, target.stat().st_size


def main(root):
    root = Path(root)
    total_before = total_after = count = 0
    busy = []
    for leftover in root.rglob("*.tmp.*"):
        try:
            leftover.unlink()
        except OSError:
            pass
    todo = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SOURCE_EXTS or ".tmp." in path.name:
            continue
        if path.parent.name == "players" and not photo_done(path):
            todo.append((path, optimize_photo, photo_reason(path)))
        elif path.stem.lower().startswith("crest") and path.parent.name != "players" and not crest_done(path):
            todo.append((path, optimize_crest, crest_reason(path)))
    if not todo:
        print("Everything is already optimised.")
        return
    print(f"{len(todo)} image(s) to optimise.")
    gone = []
    for i, (path, run, reason) in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {path}  ({reason})", flush=True)
        try:
            before, after = run(path)
        except FileBusy as error:
            busy.append((path, error))
            continue
        except FileNotFoundError:
            gone.append(path)
            continue
        total_before += before
        total_after += after
        count += 1
    print(f"{count} images: {total_before / 1e6:.1f} MB -> {total_after / 1e6:.1f} MB")
    if gone:
        print("Skipped because they were renamed or moved while this was running:")
        for path in gone:
            print("  " + str(path))
    if busy:
        print("Could not overwrite these. Windows refused access (usually OneDrive syncing them):")
        for path, error in busy:
            print(f"  {path}  [{error}]")
        print("Pause OneDrive (tray icon > gear > Pause syncing), close image previews, then run again.")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "assets/teams")