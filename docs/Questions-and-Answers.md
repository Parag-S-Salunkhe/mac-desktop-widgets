# Questions & Answers

1. <ins>Why Übersicht and not macOS's own desktop widgets?</ins>

Apple's widgets are boxed cards in fixed sizes, and they can't run a shell command. Übersicht widgets are plain HTML/CSS with a shell command behind them, so they can show anything the Mac knows and look like text on the photo.

2. <ins>Is it safe to run shell commands from a desktop widget?</ins>

The commands are fixed in the widget files, run as your user, and don't need sudo. Übersicht's server listens only on localhost and refuses requests from other websites (403). The one place that takes outside input, the wallpaper feed, sanitises every value before it's used in a file name or a link.

3. <ins>Why is my swap not zero? Is that bad?</ins>

A little swap is normal on macOS: idle pages get written out so RAM can be used as cache. What matters is **memory pressure** (the coloured dot). The **Clear swap** button only appears from 1 GB.

4. <ins>What is "compressed" memory?</ins>

Before swapping to disk, macOS compresses inactive memory pages in RAM. It's faster than disk, but it costs CPU. A big compressed slice means apps are holding more than the Mac has room for.

5. <ins>Why does the network show less than my internet speed?</ins>

The live numbers are what's moving **right now** (10 s average), not the line's capacity. The **Speed** button measures capacity.

6. <ins>Why can't it show GPU temperature or power?</ins>

Those need `powermetrics`, which needs sudo. The widget sticks to what a normal user can read.

7. <ins>Where does the wallpaper story come from?</ins>

Bing's homepage API (`HPImageArchive` and the `hp/api/model` endpoint) for the daily picture, and Microsoft's Spotlight feed for the ↻ button. No account is needed.

8. <ins>Does it work on Intel Macs?</ins>

The commands exist on both, but I built and tested it on Apple Silicon only. GPU numbers come from `IOAccelerator`, which reports differently on some Intel GPUs.

9. <ins>Does the Claude card call Anthropic's API or need a key?</ins>

No. Claude Code already sends the plan limits, context and cost to the status line on every reply. The status line saves them to a local file and the card reads that file. No network, no key.

10. <ins>Why does the card show a different % than claude.ai?</ins>

The card shows the last reading Claude Code received. Use on claude.ai or the desktop app counts against the same limits, but the card only sees it after your next Claude Code reply. The header says *as of <time>* when the reading is older than 15 minutes.

11. <ins>Is the $ what I pay?</ins>

No. It's what the session would cost at API prices. On a subscription it's useful for comparing sessions, not a bill.
