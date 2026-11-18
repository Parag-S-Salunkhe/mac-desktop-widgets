# Part 5: Claude Code usage on the desktop

How much of my Claude plan is left, and which sessions are open, without typing `/usage`. Two pieces:

- a **status line** inside Claude Code (one line at the bottom of the terminal), and
- a **card** on the desktop under the stats card, in the same style.

```
Opus 5.5 · ctx 14% 140k/1.0M · session $3.02 · 5h 31% ↻2h05 · 7d 44%
```

```
                CLAUDE · TODAY $18.9
  ◔ 34%                    ◔ 45%
  5-HOUR · 1H 56M          WEEK · 3D 12H
  Always-on-screen Claude usage widget   16% · $3.88 ●
            Tidy up the wallpaper script   29% · $14.7 ●
                                          closed 1 ▾
```

## Where the numbers come from

Claude Code runs your status line command after every reply and sends it a JSON object on stdin. That object already holds everything the card needs, so nothing has to be estimated:

| Shown | Field on stdin | Notes |
|---|---|---|
| 5-hour and week rings | `rate_limits.five_hour` / `seven_day` → `used_percentage`, `resets_at` | Your real plan limits, the same numbers `/usage` shows |
| ctx % | `context_window.current_usage` (input + cache read + cache write) ÷ `context_window_size` | How full this session's context is |
| $ | `cost.total_cost_usd` | What the session would cost at API prices, not what the plan charges |
| Session name | `session_name` | |
| Model | `model.display_name` | in the tooltip |

The status line script (`statusline/claude-statusline.py`) prints its one line and saves that JSON to `~/Library/Caches/desk-claude/status-<session>.json` (files older than 3 days are removed). The card's script (`desk-claude.py`) reads those files every 15 s.

**Open or closed?** Claude Code keeps one file per running session in `~/.claude/sessions/<pid>.json`, with the session id and a `busy` / `idle` status. A session counts as open only while that process is alive. So:

- **green dot** = open, **glowing green** = Claude is working in it
- ended sessions move into the **closed ▾** dropdown (last 24 hours, with their $ and when they ended)

## Install

1. Copy `widgets/desk-claude.jsx` and `widgets/desk-claude.py` into the Übersicht widgets folder (Part 1 already copies everything in `widgets/`).
2. Copy the status line script somewhere stable and add it to `~/.claude/settings.json`:

```bash
mkdir -p ~/.claude/statusline
cp statusline/claude-statusline.py ~/.claude/statusline/
```

```json
"statusLine": {
  "type": "command",
  "command": "/usr/bin/python3 ~/.claude/statusline/claude-statusline.py",
  "padding": 0
}
```

Claude Code picks the change up without a restart. The card fills in after the next reply in any session.

## The card moves out of the way

The stats card's **Apps**, **Free up** and **Clear swap** panels open downwards and used to cover the Claude card. All Übersicht widgets live in one web page, so they can share a CSS variable:

- `desk-system.jsx` measures its own bottom edge on every render and sets `--stats-bottom` on `<html>`.
- `desk-claude.jsx` uses `top: calc(var(--stats-bottom, 344px) + 38px)` with a short transition, so it slides down when a panel opens and back when it closes.

One trap: the `ref` has to be a new function on every render (`ref={(el) => reportBottom(el)}`). A function defined once is called only when the widget first mounts, so the card never moved.

## Limits

- The plan numbers update when a Claude Code session gets a reply. Use on claude.ai or the desktop app counts against the same limits but shows up only after the next Claude Code reply. If the reading is older than 15 minutes, the header says *as of <time>*.
- `$` is the API-price value of the session, useful for comparing sessions, not a bill.

## Cost

Measured on an M4: the card's script takes about **0.04 s of CPU every 15 s** (about 0.03% of the Mac), reads only local files and never touches the network. The status line takes about 0.08 s, only after a reply. Session paths and working folders are saved in the cache but never passed to the card.

## 18 designs, and why I kept the first

Before settling, I had Claude build 18 alternatives straight onto the desktop to compare them on the real wallpaper: hairline bars, one line of text, tiny rings, a battery, a dot grid, a pace bar, a plain-words forecast, a target, an hourglass, weather icons, moon phases, a speedometer, a face, a glowing line along the screen edge, a giant number, an orbit, a serif sentence and a trajectory chart. All of them were fun. None of them read faster than the card that matched the rest of the desktop, so the first card stayed and got smaller instead: one line per session, details in the hover tooltip, closed sessions in a dropdown.

Back to: [README](../README.md) · Previous: [Part 4: Wallpaper](Part4-Wallpaper.md)
