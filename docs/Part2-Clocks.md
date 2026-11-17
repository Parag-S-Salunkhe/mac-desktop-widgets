# Part 2: The clock: time zones without any API

## How it works

- `command` reads the Mac's own time zone: `readlink /etc/localtime` → e.g. `Europe/London`. When you travel and macOS switches zone, the big clock follows.
- Everything else is `Intl.DateTimeFormat` with a `timeZone` option, built into the browser engine. No network, no API.
- The big time is the Mac's zone. The other zones in `ZONES` go underneath, each with a ☀ (06:00–18:00) or a ☾, and the weekday if it's a different day there.
- If one of your `ZONES` has the same local time as the Mac, it's treated as "here": its label goes on the date line instead of showing twice.

## Make it yours

```js
const ZONES = [
  { label: "London", tz: "Europe/London" },
  { label: "New York", tz: "America/New_York" },
  { label: "Tokyo", tz: "Asia/Tokyo" },
];
```

Use names from the IANA time zone database (`ls /usr/share/zoneinfo`).

## Design notes

- 12-hour time, 64 px, weight 200 (thin), tabular numbers so the digits don't jump.
- Text colour `#eef1f6`, not pure white. Pure white looked too loud on bright photos. Secondary text at 86% opacity, labels at 66%.
- A soft shadow (`0 1px 3px` at 55%) plus a dark gradient behind the right edge (the `DARK SHADE` block) keeps it readable on any wallpaper. **No `backdrop-filter`**: blur flickers in Übersicht.

Next: [Part 3: The Mac's health in one row](Part3-System-Stats.md)
