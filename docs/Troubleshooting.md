# Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| A widget is blank or frozen after an edit | Übersicht read a half-written file | Save the file again (atomically), or Übersicht menu → Refresh All Widgets |
| Text flickers | `backdrop-filter` blur | Remove it; use the gradient shade instead |
| Disk free doesn't match the Stats app | Stats adds purgeable space | The widget matches Finder (`df` Avail, decimal GB) |
| Network shows `–` | It's the first refresh: rates need two samples | Wait 10 s |
| Speed test says *timed out* | VPN path or slow line | Run it again with the VPN off to test the line itself |
| No **Quit** button for an app | It's in `KEEP`, it's not in an Applications folder, or it's a system process | By design; move the app to `/Applications` if you want it quittable |
| Wallpaper doesn't change | Already done today, or the feed is down | ↻ for a Spotlight picture; it re-checks Bing hourly |
| Battery drains faster after changing the wallpaper | System Settings is still open on the Wallpaper pane | Quit System Settings |
| Clock shows the wrong city as local | No zone in `ZONES` matches the Mac's zone | Expected: the Mac's zone name is shown instead; add it to `ZONES` if you like |
