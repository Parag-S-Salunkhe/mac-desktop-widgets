#!/usr/bin/env python3
"""Speed test for the stats widget (desk-system.jsx).

Runs macOS's own networkQuality the normal way (NOT bound with -I: with a VPN on, forcing traffic out of en0
around the VPN can time out with error -1001). So with a VPN on the result = the VPN path (what you really get);
VPN off = the line itself. The physical connection under it (Wi-Fi / hub Ethernet) =
macOS's primary interface, saved with the result.
Writes one tab line to ~/Library/Caches/desk-speedtest.txt (the widget reads it every refresh):
  speed <epoch> <down Mbps> <up Mbps> <tested interface> <physical port name> <idle ping ms>
Failure -> prints "error<TAB><plain-English reason>" (cache keeps the last good result).
A lock file (created atomically) stops two tests running at once; a lock older than 90 s is a crashed run.
Note: runs ~15 s at full speed, so on fast Ethernet one test can move 1-2 GB (avoid on a phone hotspot).
"""
import json
import os
import subprocess
import time

CACHE = os.path.expanduser("~/Library/Caches/desk-speedtest.txt")
LOCK = CACHE + ".lock"
# NSURLError codes networkQuality reports
ERRORS = {-1009: "no internet", -1001: "timed out", -1003: "server not found", -1004: "could not connect",
          -1005: "connection lost", -1020: "no internet (data not allowed)"}


class Fail(Exception):
    pass


def primary_interface():
    out = subprocess.run(["/usr/sbin/scutil"], input="show State:/Network/Global/IPv4\n",
                         capture_output=True, text=True, timeout=5).stdout
    for line in out.splitlines():
        if "PrimaryInterface" in line:
            return line.split(":", 1)[1].strip()
    return ""


def port_name(dev):
    out = subprocess.run(["/usr/sbin/networksetup", "-listallhardwareports"],
                         capture_output=True, text=True, timeout=5).stdout
    name = ""
    for line in out.splitlines():
        if line.startswith("Hardware Port:"):
            name = line.split(":", 1)[1].strip()
        elif line.startswith("Device:") and line.split(":", 1)[1].strip() == dev:
            return name
    return dev


def clean(s):
    return "".join(c for c in str(s) if c.isprintable() and c != "\t")[:60]


def take_lock():
    for _ in range(2):
        try:
            os.close(os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600))
            return True
        except FileExistsError:
            try:
                if time.time() - os.path.getmtime(LOCK) < 90:
                    return False
                os.remove(LOCK)  # stale: a run that crashed
            except FileNotFoundError:
                pass
    return False


def run_test():
    dev = primary_interface()
    if not dev:
        raise Fail("no internet")
    try:
        r = subprocess.run(["/usr/bin/networkQuality", "-c", "-M", "15"], capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired:
        raise Fail("took too long")
    if not r.stdout.strip():
        raise Fail("no result (no internet?)")
    try:
        d = json.loads(r.stdout)
    except ValueError:
        raise Fail("no result")
    code = d.get("error_code")
    if code:
        raise Fail(ERRORS.get(code, f"error {code}"))
    iface = d.get("interface_name") or dev
    return "\t".join([
        "speed", str(int(time.time())),
        f"{d.get('dl_throughput', 0) / 1e6:.0f}", f"{d.get('ul_throughput', 0) / 1e6:.0f}",
        clean(iface), clean(port_name(dev)), f"{d.get('base_rtt', 0):.0f}",
    ])


def main():
    if not take_lock():
        print("busy")
        return
    try:
        line = run_test()
        tmp = CACHE + ".tmp"
        with open(tmp, "w") as f:
            f.write(line + "\n")
        os.replace(tmp, CACHE)
        print(line)
    except Fail as e:
        print("error\t" + clean(e))
    except Exception as e:  # anything unexpected: short, readable
        print("error\t" + clean(type(e).__name__))
    finally:
        try:
            os.remove(LOCK)
        except OSError:
            pass


if __name__ == "__main__":
    main()
