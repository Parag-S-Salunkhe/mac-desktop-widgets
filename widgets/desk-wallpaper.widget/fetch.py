#!/usr/bin/env python3
"""Picture of the day as wallpaper + the story behind it (like Windows Spotlight).

Run by the Übersicht widget in this folder.
  fetch.py           -> today's Bing picture (no-op once done today), prints info JSON
  fetch.py --new     -> a fresh Windows Spotlight picture (new one every call)
  fetch.py --prev    -> previous picture from the ones already saved
  fetch.py --next    -> next picture from the ones already saved
  fetch.py --fav     -> toggle ♥: copy current picture to Favourites/ (never pruned)
No accounts, no tokens. Talks only to www.bing.com and Microsoft's Spotlight feed.
"""
import datetime
import glob
import json
import os
import random
import re
import shutil
import subprocess
import sys
import time
import urllib.request

DIR = os.path.expanduser("~/Pictures/Bing Wallpapers")
INFO = os.path.join(DIR, "current.json")
FAV = os.path.join(DIR, "Favourites")
MKT, COUNTRY = "en-US", "US"   # EDIT: your Bing market, e.g. "en-GB", "GB"
KEEP = 30
UA = {"User-Agent": "Mozilla/5.0 (Macintosh)"}
SPOTLIGHT = ("https://fd.api.iris.microsoft.com/v4/api/selection?&placement=88000820"
             "&bcnt=4&country=%s&locale=%s&fmt=json" % (COUNTRY, MKT))
TODAY = datetime.date.today().isoformat()


SAFE_URL = re.compile(r"^https://[A-Za-z0-9._~:/?#\[\]@!&()*+,;=%-]+$")
JSON_MAX, IMAGE_MAX = 5 * 1024 * 1024, 60 * 1024 * 1024  # bytes; a 4K Bing JPEG is ~2-8 MB
RETRY = 3600  # seconds between Bing re-checks when today's picture/story isn't there yet


def clean(s, n=40):
    """Letters/digits only — used for file names built from feed data (no / .. or quotes)."""
    return re.sub(r"[^A-Za-z0-9]+", "", s or "")[:n]


def safe_link(url):
    return url if SAFE_URL.match(url or "") else ""


class _HttpsOnlyRedirects(urllib.request.HTTPRedirectHandler):
    """Follow redirects only to https (urllib would otherwise follow https -> http)."""
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not newurl.startswith("https://"):
            raise ValueError("refusing redirect to non-https url")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_OPENER = urllib.request.build_opener(_HttpsOnlyRedirects)


def get(url, timeout=20, limit=JSON_MAX):
    if not url.startswith("https://"):
        raise ValueError("refusing non-https url")
    req = urllib.request.Request(url, headers=UA)
    with _OPENER.open(req, timeout=timeout) as r:
        data = r.read(limit + 1)
    if len(data) > limit:
        raise ValueError("response too big")
    return data


def is_image(data):
    return data[:3] == b"\xff\xd8\xff" or data[:8] == b"\x89PNG\r\n\x1a\n"  # JPEG or PNG


def read_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def write_json(path, data):
    with open(path + ".tmp", "w") as f:  # write + rename = never a half-written file
        json.dump(data, f, indent=1)
    os.replace(path + ".tmp", path)


def download(url, path):
    if not os.path.exists(path):
        data = get(url, timeout=90, limit=IMAGE_MAX)
        if not is_image(data):
            raise ValueError("download is not an image")
        with open(path + ".part", "wb") as f:
            f.write(data)
        os.replace(path + ".part", path)
    else:
        os.utime(path)  # seen again -> newest in history


def set_wallpaper(path):
    if '"' in path or "\\" in path:  # path goes inside an AppleScript string
        return
    script = 'tell application "System Events" to tell every desktop to set picture to POSIX file "%s"' % path
    subprocess.run(["/usr/bin/osascript", "-e", script], capture_output=True)


def history():
    return sorted(glob.glob(os.path.join(DIR, "*.jpg")), key=os.path.getmtime)


def fav_path(path):
    return os.path.join(FAV, os.path.basename(path))


def toggle_fav():
    current = read_json(INFO)
    if not current or not os.path.exists(current.get("path", "")):
        return current
    dest = fav_path(current["path"])
    if os.path.exists(dest):
        os.remove(dest)
        if os.path.exists(dest + ".json"):
            os.remove(dest + ".json")
    else:
        os.makedirs(FAV, exist_ok=True)
        shutil.copy2(current["path"], dest)
        if os.path.exists(current["path"] + ".json"):
            shutil.copy2(current["path"] + ".json", dest + ".json")
    current["fav"] = os.path.exists(dest)
    write_json(INFO, current)
    return current


def show(info):
    """Make `info` the current wallpaper and print it for the widget."""
    info["fav"] = os.path.exists(fav_path(info["path"]))
    hist = history()
    if info["path"] in hist:
        info["pos"] = "%d / %d" % (hist.index(info["path"]) + 1, len(hist))
    current = read_json(INFO)
    if not current or current.get("path") != info["path"]:
        set_wallpaper(info["path"])
    write_json(INFO, info)
    print(json.dumps(info))


def prune(keep_path):
    for old in history()[:-KEEP]:
        if old != keep_path:
            os.remove(old)
            if os.path.exists(old + ".json"):
                os.remove(old + ".json")


def bing_daily():
    arch = json.loads(get(
        "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=%s" % MKT))["images"][0]
    base = arch["urlbase"]
    if not base.startswith("/") or base.startswith("//"):  # must stay a path on www.bing.com
        raise ValueError("unexpected Bing image path")
    slug = clean(base.split("OHR.")[-1].split("_")[0]) or "Bing"
    story = {}
    try:
        model = json.loads(get("https://www.bing.com/hp/api/model?mkt=%s" % MKT))
        for mc in model.get("MediaContents", []):
            ic = mc.get("ImageContent", {})
            if clean(ic.get("Image", {}).get("Wallpaper", "").split("OHR.")[-1].split("_")[0]) == slug:
                story = ic
    except Exception:
        pass
    path = os.path.join(DIR, "bing-%s-%s.jpg" % (clean(arch.get("startdate", ""), 8) or TODAY.replace("-", ""), slug))
    download("https://www.bing.com%s_UHD.jpg" % base, path)
    place, _, credit = arch.get("copyright", "").partition(" (")
    meta = {
        "source": "Bing · picture of the day",
        "headline": story.get("Headline") or arch.get("title", ""),
        "place": story.get("Title") or place,
        "credit": credit.rstrip(")"),
        "story": story.get("Description", ""),
        "link": safe_link(arch.get("copyrightlink", "")),
        "path": path,
        "added": TODAY,  # Bing's startdate is UTC; local date reads right
    }
    write_json(path + ".json", meta)
    # done for today only when Bing has switched to today's picture AND its story is out;
    # otherwise (just after midnight / story not published yet) check again in an hour, not every 2 min
    fresh = clean(arch.get("startdate", ""), 8) >= TODAY.replace("-", "")
    if meta["story"] and fresh:
        meta["checked"] = TODAY
    else:
        meta["checked"] = ""
        meta["retry_at"] = int(time.time()) + RETRY
    return meta


def spotlight_new():
    data = json.loads(get(SPOTLIGHT))
    ads = [json.loads(it["item"])["ad"] for it in data["batchrsp"]["items"]]
    current = read_json(INFO) or {}
    random.shuffle(ads)
    ad = next((a for a in ads if a.get("title") != current.get("headline")), ads[0])
    title = ad.get("title", "Spotlight")
    slug = clean(title) or "Spotlight"
    path = os.path.join(DIR, "spot-%s.jpg" % slug)
    download(ad["landscapeImage"]["asset"], path)
    hover = ad.get("iconHoverText", "").split("\r\n")
    meta = {
        "source": "Windows Spotlight",
        "headline": title,
        "place": hover[0] if hover else "",
        "credit": ad.get("copyright", ""),
        "story": ad.get("description", ""),
        "link": safe_link(ad.get("ctaUri", "").replace("microsoft-edge:", "")),
        "path": path,
        "added": TODAY,
    }
    write_json(path + ".json", meta)
    meta["checked"] = TODAY
    return meta


def browse(step):
    hist = history()
    if not hist:
        return None
    current = read_json(INFO) or {}
    i = hist.index(current["path"]) if current.get("path") in hist else len(hist) - 1
    path = hist[max(0, min(len(hist) - 1, i + step))]
    meta = read_json(path + ".json") or {"headline": os.path.basename(path), "path": path}
    meta["path"] = path
    if not meta.get("added"):  # older sidecars had no date -> day the info was saved
        src = path + ".json" if os.path.exists(path + ".json") else path
        meta["added"] = datetime.date.fromtimestamp(os.path.getmtime(src)).isoformat()
    meta["checked"] = TODAY
    return meta


def main():
    os.makedirs(DIR, exist_ok=True)
    args = sys.argv[1:]
    current = read_json(INFO)
    if "--fav" in args:
        print(json.dumps(toggle_fav() or {"error": "no picture yet"}))
        return
    try:
        if "--prev" in args or "--next" in args:
            meta = browse(-1 if "--prev" in args else 1)
        elif "--new" in args:
            meta = spotlight_new()
        elif current and os.path.exists(current.get("path", "")) and (
                current.get("checked") == TODAY or current.get("retry_at", 0) > time.time()):
            current["fav"] = os.path.exists(fav_path(current["path"]))
            print(json.dumps(current))
            return
        else:
            meta = bing_daily()
    except Exception as e:
        if current:
            current["offline"] = True
            print(json.dumps(current))
        else:
            print(json.dumps({"error": "offline: %s" % e}))
        return
    if not meta:
        print(json.dumps(current or {"error": "no pictures yet"}))
        return
    prune(meta["path"])
    show(meta)


if __name__ == "__main__":
    main()
