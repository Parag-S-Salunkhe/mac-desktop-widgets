# Part 3: The Mac's health in one row

Everything comes from commands that ship with macOS and need no sudo. Together they run in tens of milliseconds every 10 s. The widget's `command` prints `key<TAB>value` lines and `updateState` turns them into numbers.

## Where each number comes from

| Shown | Command | Notes |
|---|---|---|
| CPU % | `ps -axo pcpu=,rss=,comm=` summed ÷ `hw.ncpu` | Helpers are grouped under their `.app`, so all of Chrome's processes count as "Google Chrome" |
| Busiest / biggest app | same `ps` output | busiest = most CPU, biggest = most resident memory |
| GPU % | `ioreg -r -d 1 -c IOAccelerator` → `Device Utilization %` | No GPU temperature or power without sudo |
| Memory ring | `vm_stat`: app = anonymous − purgeable, system = wired, compressed = occupied by compressor | Shown as `used / total GB` |
| Pressure | `sysctl kern.memorystatus_level` | coloured dot + word; watch this, not "free memory" |
| Swap | `sysctl vm.swapusage` | a little swap is normal |
| Thermal | `notifyutil -g com.apple.system.thermalpressurelevel` | 0 cool, 1 warm, 2+ hot/throttling |
| Network ↓↑ | `netstat -ibn`, the `Link#` rows of `en*` interfaces | bytes since the last refresh ÷ seconds. VPN `utun` interfaces are skipped, because counting them too would double the traffic |
| Connection in use | `scutil` → `State:/Network/Global/IPv4` → `PrimaryInterface` | names from `networksetup -listallhardwareports`, Ethernet link speed from `ifconfig` (amber under 1 Gb usually means a hub or cable limit) |
| Disk | `df -k /System/Volumes/Data` → Avail, in **decimal GB** | matches Finder |
| Uptime | `uptime` | |

## The summary line

```
● normal · swap 0 MB · Chrome 12% · Chrome 3.1 GB
```

Pressure, swap, busiest app, biggest-memory app. Long names are shortened: the maker's name is dropped, and anything over 10 characters keeps its first word.

## Apps / Free up panel

`desk-memapps.py` runs only when you open the panel (`top -l 1` takes about a second):

- **Apps** ranks apps by real memory footprint (`top -stats pid,mem`), with helpers grouped under their app.
- **Quit** asks the app to quit like Cmd+Q (`osascript ... to quit`), with a two-click confirm. Only apps in `/Applications` or `~/Applications` can be quit. Anything in `KEEP` (your terminal, Finder, the widgets, and your VPN or security tools: add them) never gets a button.
- **Clear swap** appears only when swap is 1 GB or more (amber; red from 3 GB). It ranks apps by compressed memory (`top -stats pid,cmprs`). Quitting the top one frees its swap.

## Speed test

Click **Speed** and `desk-speedtest.py` runs macOS's own `networkQuality -c -M 15` (about 15 s and ~50 MB on a normal line; on fast Ethernet it can move 1–2 GB, so avoid it on a phone hotspot). The result line shows `max ↓ ↑ Mbps · path · ping · age` and is kept in `~/Library/Caches/desk-speedtest.txt`.

- Live rates in the stats row = data moving **right now** (10 s average), not the line's top speed.
- With a VPN on, the test measures the VPN path, which is what you really get. Forcing it out of the Wi-Fi interface around the VPN times out (`-1001`), so the test isn't bound to an interface.
- A lock file created with `O_EXCL` stops two tests running at once; a lock older than 90 s is treated as a crashed run.

## Bugs we fixed along the way

- Disk free was `size − used`, which came out **21 GB too high**. `df`'s Avail matches Finder. (The Stats app shows even more because it adds purgeable space.)
- awk traps: don't reuse `n` as a `-v` variable name, and after `sub()` force numbers with `v = v + 0`, or awk compares them as strings.
- Process names from `ps` can hold decomposed letters (`Übersicht` = U + ¨). Compare names in NFC form, or the KEEP list misses them.

Next: [Part 4: The daily wallpaper](Part4-Wallpaper.md)
