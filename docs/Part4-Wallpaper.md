# Part 4: A daily wallpaper with its story, made safe

Windows has Spotlight: a new photo on the lock screen with a line about where it was taken. This widget brings that to the Mac desktop.

## What it does

| Button / command | Action |
|---|---|
| (automatic) `fetch.py` | Bing's picture of the day in 4K (UHD) becomes the wallpaper. After the first success it does nothing for the rest of the day |
| ↻ `fetch.py --new` | a fresh Windows Spotlight picture, a new one on every click |
| ‹ › `--prev` / `--next` | step through the pictures already saved |
| ♥ `--fav` | copy the current picture to `Favourites/` (never deleted) |
| (i) | show the story behind the picture |
| ↗ | open the "learn more" link (https links only) |

Pictures and their `.json` caption files live in `~/Pictures/Bing Wallpapers`. The last 30 are kept.

Set your market in `fetch.py` (`MKT, COUNTRY = "en-US", "US"`): Bing's picture and story differ by region.

## The caption

Text straight on the photo at the bottom right, right-aligned: a small kicker (source · date), a 30 px light title, 📍 the place, then round ghost buttons. The story stays hidden until you tap (i). It has no dark gradient behind it on purpose: a caption should feel like part of the photo.

## How it sets the wallpaper

```
tell application "System Events" to tell every desktop to set picture to POSIX file "<file>"
```

Run with `osascript`, so every desktop and every screen gets it. File names built from feed data are limited to letters and digits, and a path containing a quote or backslash is refused, so it can never break out of the AppleScript string.

## Making it safe (the review pass)

Downloading files from the internet and handing them to the OS is exactly where small scripts go wrong. These checks are all in `fetch.py`:

- **HTTPS only**, including redirects. Python's `urllib` will happily follow an https → http redirect unless you stop it.
- **Size caps:** JSON 5 MB, images 60 MB.
- **Magic-byte check:** the file must start like a real JPEG or PNG, whatever its name says.
- Bing's image path must start with exactly one `/`, so it stays a path on `www.bing.com` (`//evil.example` would be a different host).
- **Atomic writes** for the JSON (temp file + rename).
- Links in captions are kept only if they are plain `https://` URLs (regex check). The widget opens them inside single quotes.
- Network politeness: if the story is missing or the picture is still yesterday's, it re-checks **hourly** (`retry_at`), not every 2 minutes.
- No accounts, no API keys. It talks only to `www.bing.com` and Microsoft's Spotlight feed.

Next: [Part 5: Claude Code usage](Part5-Claude-Usage.md) · Back to: [README](../README.md) · See also [Do's and Don'ts](Dos-and-Donts.md)
