# Do's and Don'ts

## ✅ Do

- **Use cheap commands** (`ps`, `vm_stat`, `sysctl`, `ioreg`, `netstat`, `df`) and refresh every 10 s or slower. `top -l 1` takes a second, so run it only when a panel is open.
- **Watch memory pressure, not "free memory".** macOS uses spare RAM as cache on purpose; pressure and swap tell you when it's actually short.
- **Show disk free as `df` Avail in decimal GB,** so it matches Finder.
- **Group helper processes under their app.** Otherwise Chrome looks like 30 small apps instead of one big one.
- **Put your VPN and security tools in `KEEP`** in `desk-memapps.py`, so the Free up panel never offers to quit them.
- **Write widget files atomically** (temp file + rename).
- **Validate everything you download** (HTTPS only, size caps, magic bytes) before handing it to the OS.
- **Let widgets talk through a CSS variable** when one needs to react to another (they share one page). Measure in a `ref` that is a new function every render.
- **Quit System Settings after changing the wallpaper.** The Wallpaper pane keeps playing aerial previews in the background.

## ❌ Don't

- **Don't use `backdrop-filter` (blur) in Übersicht.** It flickers. Use a solid or gradient background, or text with a shadow.
- **Don't add VPN (`utun`) traffic to the network total.** It's the same bytes as Wi-Fi or Ethernet, counted twice.
- **Don't bind the speed test to an interface** when a VPN is on. It times out.
- **Don't kill processes.** Ask the app to quit (`osascript ... to quit`) so it can save, and never offer system processes.
- **Don't animate constantly.** Rings and text change only when the numbers do: a desktop widget shouldn't cost battery.
- **Don't use pure white text** on photos. `#eef1f6` with a soft shadow reads better and looks calmer.
- **Don't edit a live widget with `sed -i`.** A half-written file can leave Übersicht stuck.

## 🤝 Building it with an AI

- Ask for **four design options** for each widget, rendered side by side, then pick one. It's faster than describing what you want in words.
- Ask it to **review its own code for security** once the design is final. That pass found the https → http redirect, the missing size caps and the AppleScript quoting issue.
