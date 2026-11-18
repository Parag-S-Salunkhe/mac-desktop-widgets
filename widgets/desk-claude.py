#!/usr/bin/python3
"""Data for desk-claude.jsx.

Reads the per-session files the Claude Code status line script writes
(statusline/claude-statusline.py -> ~/Library/Caches/desk-claude/status-<session>.json)
and Claude Code's own list of running sessions (~/.claude/sessions/<pid>.json: sessionId + busy/idle;
a session counts as open only while its pid is alive).
Prints one JSON object: plan limits (newest reading), open sessions, closed sessions (last 24 h), today's total.
Local files only, no network. Paths/cwd are NOT passed on to the widget.
"""
import glob, json, os, time

CACHE = os.path.expanduser("~/Library/Caches/desk-claude")
LIVE = os.path.expanduser("~/.claude/sessions")
now = time.time()
midnight = time.mktime(time.localtime(now)[:3] + (0, 0, 0, 0, 0, -1))


def g(d, *path):
    for p in path:
        if not isinstance(d, dict):
            return None
        d = d.get(p)
    return d


def load(p):
    try:
        with open(p) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


# running Claude Code sessions: sessionId -> busy/idle
running = {}
for p in glob.glob(os.path.join(LIVE, "*.json")):
    s = load(p) or {}
    pid, sid = s.get("pid"), s.get("sessionId")
    if not isinstance(pid, int) or not sid:
        continue
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        continue
    except PermissionError:
        pass
    running[sid] = {"status": s.get("status") or "", "name": s.get("name") or ""}

rows = [d for d in (load(p) for p in glob.glob(os.path.join(CACHE, "status-*.json"))) if d]
rows.sort(key=lambda d: d.get("_saved") or 0, reverse=True)

limits, limits_at = None, None
for d in rows:
    if d.get("rate_limits"):
        limits, limits_at = d["rate_limits"], d.get("_saved")
        break


def item(d):
    ctx = d.get("_ctx") or {}
    sid = d.get("session_id")
    return {
        "name": (d.get("session_name") or g(running, sid, "name") or "")[:60],
        "model": g(d, "model", "display_name") or "",
        "ctx": ctx.get("pct"),
        "ctxUsed": ctx.get("used"),
        "ctxSize": ctx.get("size"),
        "cost": g(d, "cost", "total_cost_usd"),
        "mins": round((g(d, "cost", "total_duration_ms") or 0) / 60000),
        "saved": d.get("_saved") or 0,
        "busy": g(running, sid, "status") == "busy",
    }


open_s = [item(d) for d in rows if d.get("session_id") in running]
closed = [item(d) for d in rows if d.get("session_id") not in running and now - (d.get("_saved") or 0) < 86400][:8]
today = [d for d in rows if (d.get("_saved") or 0) >= midnight]

print(json.dumps({
    "limits": {"five": g(limits, "five_hour"), "week": g(limits, "seven_day"), "at": limits_at} if limits else None,
    "open": open_s,
    "closed": closed,
    "todayCost": round(sum(g(d, "cost", "total_cost_usd") or 0 for d in today), 2),
}))
