# Part 1: Installing Übersicht and the widgets

[Übersicht](https://tracesof.net/uebersicht/) runs small web widgets (JSX + CSS) on the desktop. Each widget has a `command` that runs in a shell every N seconds, and a `render` function that draws the output.

## Steps

1. **Install Übersicht** (signed and notarised):

   ```bash
   brew install --cask ubersicht
   ```

2. **Copy the widgets** into its widgets folder:

   ```bash
   cp -R widgets/* "$HOME/Library/Application Support/Übersicht/widgets/"
   ```

3. **Start it at login:** Übersicht menu → Preferences → *Launch Übersicht when I login*.
4. **Tidy the desktop:** remove Apple's desktop widgets if you used them, and hide the hard-disk icon (Finder → Settings → General). That leaves the clock and stats at the top right and the picture caption at the bottom right, with the rest of the photo clear.

## Optional companion

[Stats](https://github.com/exelban/stats) (`brew install --cask stats`) puts the same kind of numbers in the menu bar. It costs about 3% CPU, more than these widgets, so it's optional.

## Files

```
widgets/desk-clocks.jsx              clock + other time zones          refresh 15 s
widgets/desk-system.jsx              rings, network, summary, panels   refresh 10 s
widgets/desk-memapps.py              per-app memory, quit, swap ranking (runs only when a panel is open)
widgets/desk-speedtest.py            networkQuality test (only when you click Speed)
widgets/desk-wallpaper.widget/       index.jsx (caption + buttons) and fetch.py (download + set wallpaper)
```

## Editing safely

Übersicht reloads a widget the moment its file changes. If it reads a half-written file, it can get stuck. **Write changes atomically:** write to a temp file and rename it over the old one. Your editor's normal save is fine; `sed -i` on the live file is the risky one.

Next: [Part 2: The clock](Part2-Clocks.md)
