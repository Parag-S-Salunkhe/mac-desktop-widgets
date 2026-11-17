![Static Badge](https://img.shields.io/badge/macOS-black?logo=apple&logoColor=white) ![Static Badge](https://img.shields.io/badge/%C3%9Cbersicht-widgets-black)
![Static Badge](https://img.shields.io/badge/JSX-React-black?logo=react&logoColor=%2361DAFB) ![Static Badge](https://img.shields.io/badge/Python-stdlib%20only-black?logo=python&logoColor=%233776AB)
![Static Badge](https://img.shields.io/badge/Claude%20Code-pair%20programming-black?logo=anthropic&logoColor=%23D97757)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="images/hero-dark.svg" />
    <img src="images/hero-light.svg" width="100%" alt="Mac desktop widgets: a thin clock, CPU, GPU and memory rings, network rates and a picture-of-the-day caption, drawn straight on the wallpaper" />
  </picture>
</p>

# Mac desktop widgets

I wanted a desktop that tells me something at a glance without looking like a dashboard: a big thin clock, the Mac's health in one row of rings, and a new wallpaper every day with the story behind it, Windows Spotlight style. No cards and no boxes, just text straight on the photo with a soft shadow.

My motive was also to learn how much a Mac tells you with built-in commands only (`ps`, `vm_stat`, `ioreg`, `netstat`, `scutil`) and to build it in an afternoon with Claude Code. No sudo, no accounts, no API keys.

| Widget | What it shows |
|---|---|
| **Clocks** (`desk-clocks.jsx`) | Big local time in 12-hour format, the date, and up to three more time zones with a sun or moon |
| **This Mac** (`desk-system.jsx`) | Ring gauges for CPU, GPU and memory (app / system / compressed); network ↓↑ for the connection in use; pressure · swap · busiest app · biggest-memory app; uptime; disk behind a button |
| **Apps / Free up** (`desk-memapps.py`) | Your apps ranked by real memory footprint (helpers grouped under their app); quit one with a two-click confirm. **Clear swap** appears only when swap is over 1 GB |
| **Speed** (`desk-speedtest.py`) | One click runs macOS's own `networkQuality` test (~15 s) and keeps the result |
| **Wallpaper** (`desk-wallpaper.widget/`) | Bing picture of the day in 4K, or a fresh Windows Spotlight picture; magazine-style caption; ‹ › history, ♥ favourites, (i) story, ↗ learn more; keeps the last 30 |

## The guide

[Part 1](docs/Part1-Install.md): Installing Übersicht and the widgets

[Part 2](docs/Part2-Clocks.md): The clock: time zones without any API

[Part 3](docs/Part3-System-Stats.md): CPU, GPU, memory, network and swap from built-in commands, and the Free up panel

[Part 4](docs/Part4-Wallpaper.md): A daily wallpaper with its story, made safe

Also: [Do's and Don'ts](docs/Dos-and-Donts.md) · [Questions & Answers](docs/Questions-and-Answers.md) · [Troubleshooting](docs/Troubleshooting.md)

## Quick start

```bash
brew install --cask ubersicht
git clone https://github.com/Parag-S-Salunkhe/mac-desktop-widgets
cp -R mac-desktop-widgets/widgets/* "$HOME/Library/Application Support/Übersicht/widgets/"
```

Open Übersicht. The widgets appear on the right edge of the desktop. Edit `ZONES` in `desk-clocks.jsx` to pick your time zones.

## Light on battery

- The stats widget runs cheap commands every 10 s: about **11 ms of CPU every 5 s** in total. Übersicht itself stays under 0.2% CPU.
- Nothing animates constantly. The wallpaper checks the network once a day.
- The real drain I found while building this wasn't the widgets: it was **System Settings left open on the Wallpaper pane**, which keeps playing the aerial previews (6–8% CPU). Quit System Settings after changing the wallpaper.

## Security

- Übersicht's local server listens only on `127.0.0.1` and refuses requests from other websites.
- The wallpaper script downloads over **HTTPS only**, follows HTTPS-only redirects, caps file sizes, checks the image's magic bytes, keeps file names to letters and digits, and writes files atomically.
- Links are opened only if they are plain `https://` links.
- The Free up panel can only quit apps installed in an Applications folder, never system processes, and it re-checks the app before quitting. It asks the app to quit like Cmd+Q, so you can still save your work.

Time and cost: one afternoon, $0.

## Built with

[Übersicht](https://tracesof.net/uebersicht/) (JSX widgets), Python's standard library, macOS's built-in commands, and [Claude Code](https://claude.com/claude-code) as my pair programmer. I picked every design option (there were four of each) and Claude wrote and tested the code.
