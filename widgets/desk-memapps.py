#!/usr/bin/env python3
"""Memory per app (helpers grouped under their app), for the This Mac card.

  desk-memapps.py              -> JSON list of the top apps by memory
  desk-memapps.py --swap       -> same, ranked by compressed/swapped memory (what "Clear swap" shows)
  desk-memapps.py --quit NAME  -> politely quit one app (like Cmd+Q; it may ask to save)
Runs only when the card's panel is opened (top -l 1 takes ~1 s).
"""
import json
import re
import os
import subprocess
import sys
import unicodedata

# Never offered for quitting: system, your terminal, the widgets themselves.
# EDIT: add your VPN client and any security / device-management apps your Mac must keep running.
KEEP = {"iTerm", "iTerm2", "Terminal", "Finder", "Übersicht", "Stats", "Dock", "SystemUIServer",
        "WindowServer", "loginwindow", "Control Center", "Notification Center"}
# Paths that are never quittable even inside /Applications (e.g. a security agent's bundle folder).
KEEP_PATH_PARTS = ()
# Only apps installed in an Applications folder can be quit (agents in /Library, /opt, /usr, /System never).
APP_DIRS = ("/Applications/", os.path.expanduser("~/Applications/"))


def nfc(s):
    """macOS process paths can hold decomposed letters (Übersicht = U + ¨); compare in one form."""
    return unicodedata.normalize("NFC", s)


KEEP = {nfc(k) for k in KEEP}


def mb(s):
    m = re.match(r"([\d.]+)([BKMGT])", s)
    if not m:
        return 0.0
    n, u = float(m.group(1)), m.group(2)
    return n * {"B": 1 / 1048576, "K": 1 / 1024, "M": 1, "G": 1024, "T": 1048576}[u]


def app_of(path):
    """('Google Chrome', True) for anything inside Google Chrome.app; (proc, False) otherwise."""
    if "/claude/versions/" in path or path.endswith("/claude") or path == "claude":
        return "Claude Code (terminal)", False
    path = nfc(path)
    m = re.search(r"/([^/]+)\.app/", path + "/")
    if m:
        name = m.group(1)
        user_app = path.startswith(APP_DIRS) and not any(p in path for p in KEEP_PATH_PARTS)
        return name, user_app and name not in KEEP
    return path.rsplit("/", 1)[-1], False


def top_apps(limit=7, stat="mem"):
    paths = {}
    ps = subprocess.run(["ps", "-axo", "pid=,comm="], capture_output=True, text=True).stdout
    for line in ps.splitlines():
        line = line.strip()
        if line:
            pid, _, comm = line.partition(" ")
            paths[pid] = comm.strip()
    top = subprocess.run(["top", "-l", "1", "-o", stat, "-n", "150", "-stats", "pid," + stat],
                         capture_output=True, text=True).stdout
    groups = {}
    started = False
    for line in top.splitlines():
        if line.startswith("PID"):
            started = True
            continue
        if not started or not line.strip():
            continue
        pid, mem = line.split()[:2]
        name, quittable = app_of(paths.get(pid, "?"))
        g = groups.setdefault(name, {"name": name, "mb": 0.0, "procs": 0, "quit": quittable})
        g["mb"] += mb(mem.rstrip("+-"))
        g["procs"] += 1
    apps = [g for g in sorted(groups.values(), key=lambda g: -g["mb"]) if g["mb"] >= 1][:limit]
    for a in apps:
        a["mb"] = round(a["mb"])
    return apps


def quittable_running():
    """Names of running user apps that may be quit (same rule as the Quit buttons)."""
    ps = subprocess.run(["ps", "-axo", "comm="], capture_output=True, text=True).stdout
    names = set()
    for line in ps.splitlines():
        name, ok = app_of(line.strip())
        if ok:
            names.add(name)
    return names


def main():
    if "--quit" in sys.argv:
        i = sys.argv.index("--quit") + 1
        name = nfc(sys.argv[i]) if i < len(sys.argv) else ""
        # only an app the card itself would offer: running, user-installed, not on the KEEP list
        if not name or name in KEEP or name not in quittable_running():
            print(json.dumps({"error": "not allowed"}))
            return
        subprocess.run(["/usr/bin/osascript", "-e", 'tell application "%s" to quit' % name.replace('"', "")],
                       capture_output=True)
    print(json.dumps(top_apps(stat="cmprs" if "--swap" in sys.argv else "mem")))


if __name__ == "__main__":
    main()
