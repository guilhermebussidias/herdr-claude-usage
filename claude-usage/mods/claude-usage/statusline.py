#!/usr/bin/env python3
"""Claude Code statusLine command for the Herdr "claude-usage" mod.

Claude Code pipes a JSON object to this script on every status line refresh.
The script saves only `rate_limits` (used percentage and reset time of the
5-hour and 7-day windows) to ~/.cache/claude-usage/limits.json and prints
nothing, so the status line stays empty.

    statusline.py                    save limits, print nothing
    statusline.py --summary          save limits, print "Opus · session 17% · week 18%"
    statusline.py --then "<cmd>"     save limits, then run your existing status
                                     line command with the same input and print
                                     its output

No network access and no credentials: it only reads stdin and writes one file.
"""
import json
import os
import subprocess
import sys
import tempfile
import time
from datetime import datetime

CACHE = os.path.join(os.path.expanduser("~"), ".cache", "claude-usage", "limits.json")
WINDOWS = ("five_hour", "seven_day")


def extract(data):
    limits = data.get("rate_limits") if isinstance(data, dict) else None
    out = {}
    for key in WINDOWS:
        w = (limits or {}).get(key)
        if isinstance(w, dict) and isinstance(w.get("used_percentage"), (int, float)):
            resets = w.get("resets_at")
            out[key] = {
                "used_percentage": float(w["used_percentage"]),
                "resets_at": int(resets) if isinstance(resets, (int, float)) else None,
            }
    return out


def save(windows):
    now = time.time()
    offset = datetime.fromtimestamp(now).astimezone().utcoffset()
    record = dict(windows, updated_at=int(now), tz_offset_min=int(offset.total_seconds() // 60))
    folder = os.path.dirname(CACHE)
    os.makedirs(folder, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=folder, prefix=".limits-")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(record, f)
        os.replace(tmp, CACHE)
    except Exception:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def summary(data, windows):
    model = ((data.get("model") if isinstance(data, dict) else None) or {}).get("display_name") or "Claude"
    parts = [model]
    if "five_hour" in windows:
        parts.append(f"session {windows['five_hour']['used_percentage']:.0f}%")
    if "seven_day" in windows:
        parts.append(f"week {windows['seven_day']['used_percentage']:.0f}%")
    return " · ".join(parts)


def main(argv):
    raw = sys.stdin.read()
    try:
        data = json.loads(raw)
    except ValueError:
        data = {}
    windows = extract(data)
    if windows:
        try:
            save(windows)
        except OSError:
            pass  # never break the status line over the cache
    if argv[:1] == ["--summary"]:
        print(summary(data, windows))
    elif argv[:1] == ["--then"] and len(argv) > 1:
        try:
            r = subprocess.run(argv[1], shell=True, input=raw, capture_output=True, text=True, timeout=10)
            sys.stdout.write(r.stdout)
        except subprocess.TimeoutExpired:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
