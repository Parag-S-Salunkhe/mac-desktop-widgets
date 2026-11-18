#!/usr/bin/python3
"""Claude Code status line.

Claude Code pipes a JSON blob about the session on stdin after each message. This script:
  1. prints ONE line for the bottom of the terminal: model · context used · session cost · plan limits
  2. saves the same blob (plus the context it worked out) to ~/Library/Caches/desk-claude/status-<session>.json
     so the Übersicht widget desk-claude.jsx can show it on the desktop.
Local only: no network, no secrets. Must stay fast (runs after every message).
"""
import json, os, sys, time, tempfile

CACHE = os.path.expanduser("~/Library/Caches/desk-claude")
DIM, RST = "\033[2m", "\033[0m"
GREEN, AMBER, RED, BLUE = "\033[32m", "\033[33m", "\033[31m", "\033[36m"


def g(d, *path, default=None):
    for p in path:
        if not isinstance(d, dict) or p not in d:
            return default
        d = d[p]
    return d


def colour(pct):
    return GREEN if pct < 60 else AMBER if pct < 85 else RED


def fmt_tok(n):
    return f"{n / 1e6:.1f}M" if n >= 1e6 else f"{n / 1e3:.0f}k" if n >= 1e3 else str(int(n))


def context_from_transcript(path, model_id):
    """Last main-chain assistant message: input + cache read + cache write = tokens in the context now."""
    try:
        size = os.path.getsize(path)
        with open(path, "rb") as f:
            f.seek(max(0, size - 400_000))
            lines = f.read().splitlines()
    except OSError:
        return None
    for raw in reversed(lines):
        if b'"usage"' not in raw:
            continue
        try:
            d = json.loads(raw)
        except ValueError:
            continue
        if d.get("isSidechain") or d.get("type") != "assistant":
            continue
        u = g(d, "message", "usage") or {}
        used = (u.get("input_tokens") or 0) + (u.get("cache_read_input_tokens") or 0) + (u.get("cache_creation_input_tokens") or 0)
        size = 1_000_000 if "[1m]" in (model_id or "") else 200_000
        return {"used": used, "size": size, "pct": round(used * 100 / size, 1)}
    return None


def save(d):
    sid = d.get("session_id")
    if not sid or not all(c.isalnum() or c == "-" for c in sid):
        return
    os.makedirs(CACHE, mode=0o700, exist_ok=True)
    d["_saved"] = time.time()
    fd, tmp = tempfile.mkstemp(dir=CACHE, prefix=".tmp-")
    with os.fdopen(fd, "w") as f:
        json.dump(d, f)
    os.replace(tmp, os.path.join(CACHE, f"status-{sid}.json"))
    # prune: session files not touched for 3 days
    if int(time.time()) % 20 == 0:
        for n in os.listdir(CACHE):
            p = os.path.join(CACHE, n)
            try:
                if n.startswith("status-") and time.time() - os.path.getmtime(p) > 3 * 86400:
                    os.remove(p)
            except OSError:
                pass


def reset_in(ts):
    try:
        ts = float(ts)
    except (TypeError, ValueError):
        return ""
    s = ts - time.time()
    if s <= 0:
        return ""
    h, m = int(s // 3600), int(s % 3600 // 60)
    return f"{h}h{m:02d}" if h else f"{m}m"


def main():
    try:
        d = json.loads(sys.stdin.read() or "{}")
    except ValueError:
        d = {}
    model = g(d, "model", "display_name") or g(d, "model", "id") or "Claude"
    model_id = g(d, "model", "id") or ""

    # context: use Claude Code's own numbers when it sends them, else work it out from the transcript
    ctx = None
    cw = d.get("context_window")
    if isinstance(cw, dict) and cw.get("used_percentage") is not None:
        size = cw.get("context_window_size") or 0
        cu = cw.get("current_usage") or {}
        used = sum(cu.get(k) or 0 for k in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens"))
        pct = used * 100 / size if used and size else float(cw["used_percentage"])
        ctx = {"used": used or round(size * pct / 100), "size": size, "pct": round(pct, 1)}
    elif d.get("transcript_path"):
        ctx = context_from_transcript(d["transcript_path"], model_id)
    d["_ctx"] = ctx

    parts = [f"{BLUE}{model}{RST}"]
    if ctx:
        pct = ctx["pct"]
        parts.append(f"ctx {colour(pct)}{pct:.0f}%{RST} {DIM}{fmt_tok(ctx['used'])}/{fmt_tok(ctx['size'])}{RST}")
    cost = g(d, "cost", "total_cost_usd")
    if cost is not None:
        parts.append(f"session ${cost:.2f}")
    rl = d.get("rate_limits") or {}
    for key, label in (("five_hour", "5h"), ("seven_day", "7d")):
        p = g(rl, key, "used_percentage")
        if p is not None:
            r = reset_in(g(rl, key, "resets_at"))
            parts.append(f"{label} {colour(p)}{p:.0f}%{RST}" + (f" {DIM}↻{r}{RST}" if r and key == "five_hour" else ""))
    print(f" {DIM}·{RST} ".join(parts))

    try:
        save(d)
    except OSError:
        pass


if __name__ == "__main__":
    main()
