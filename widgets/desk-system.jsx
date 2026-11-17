// This Mac — no card, numbers straight on the photo (same style as the clock + picture caption).
// One compact row of rings: CPU, GPU, Memory (app/system/compressed); network down/up line; pressure, swap, thermal;
// Apps / Free up panels (desk-memapps.py); "Clear swap" only when swap is above normal (>= 1 GB); disk behind the drive button.
// Cheap commands only (ps, vm_stat, sysctl, df, notifyutil, ioreg, netstat), every 10 s. Output = "key<TAB>value" lines.
// Network speed = byte counters of the en* interfaces (Wi-Fi/Ethernet; VPN utun not added, it would double count),
// difference between two refreshes, worked out in updateState, per interface. "In use" connection = macOS primary
// interface (scutil); names from networksetup; Ethernet link speed from ifconfig media (amber under 1 Gb = hub/cable).
// Speed button = desk-speedtest.py (networkQuality, ~15 s); last result kept in ~/Library/Caches/desk-speedtest.txt.
import { css, run } from "uebersicht";

export const command = `
ncpu=$(sysctl -n hw.ncpu)
ps -axo pcpu=,rss=,comm= | awk -v nc=$ncpu '
  { c=$1; r=$2; t+=c; $1=""; $2=""; sub(/^ +/,""); p=$0;
    if (match(p, /[^\\/]+\\.app\\//)) n=substr(p,RSTART,RLENGTH-5); else { k=split(p,a,"/"); n=a[k] }
    if (p ~ /claude\\/versions\\//) n="Claude Code";
    C[n]+=c; R[n]+=r }
  END { for (k in C) if (C[k]>mc) {mc=C[k]; bc=k}; for (k in R) if (R[k]>mr) {mr=R[k]; br=k};
        printf "cpu\\t%.0f\\ntopc\\t%s\\t%.1f\\ntopm\\t%s\\t%.0f\\n", t/nc, bc, mc/nc, br, mr*1024 }'
printf 'load\\t%s\\n' "$(sysctl -n vm.loadavg | awk '{print $2}')"
printf 'memtotal\\t%s\\n' "$(sysctl -n hw.memsize)"
vm_stat | awk -v p=$(sysctl -n hw.pagesize) '
  /Anonymous pages/{an=$3} /Pages purgeable/{pu=$3} /Pages wired/{w=$4} /occupied by compressor/{c=$5}
  END{gsub(/\\./,"",an);gsub(/\\./,"",pu);gsub(/\\./,"",w);gsub(/\\./,"",c);
      printf "app\\t%.0f\\nwired\\t%.0f\\ncomp\\t%.0f\\n", (an-pu)*p, w*p, c*p}'
ioreg -r -d 1 -c IOAccelerator | grep -o '"Device Utilization %"=[0-9]*\\|"In use system memory"=[0-9]*' |
  awk -F= '/Device/{u=$2} /In use/{m=$2} END{printf "gpu\\t%d\\t%.0f\\n", u+0, m+0}'
netstat -ibn | awk '$1 ~ /^en[0-9]/ && $3 ~ /Link#/ {n=$1; sub(/\\*$/,"",n); printf "nif\\t%s\\t%.0f\\t%.0f\\n", n, $7, $10}'
printf 'primary\\t%s\\n' "$(echo 'show State:/Network/Global/IPv4' | scutil | awk '/PrimaryInterface/{print $3}')"
networksetup -listallhardwareports | awk '/^Hardware Port:/{sub(/^Hardware Port: /,""); p=$0} /^Device:/{printf "port\\t%s\\t%s\\n", $2, p}'
ifconfig | awk '/^[a-z]/{n=$1; sub(/:$/,"",n)} /^\\tinet /{ip[n]=1} /status: active/{a[n]=1} /media:.*\\(/{m=$0; sub(/.*\\(/,"",m); sub(/[ )<].*/,"",m); md[n]=m}
  END{for (k in a) if (ip[k] && k ~ /^en[0-9]/) printf "ifup\\t%s\\t%s\\n", k, md[k]}'
cat ~/Library/Caches/desk-speedtest.txt 2>/dev/null
[ -n "$(find ~/Library/Caches/desk-speedtest.txt.lock -mtime -90s 2>/dev/null)" ] && printf 'testing\\t1\\n'
true
printf 'therm\\t%s\\n' "$(notifyutil -g com.apple.system.thermalpressurelevel | awk '{print $2}')"
printf 'level\\t%s\\n' "$(sysctl -n kern.memorystatus_level)"
printf 'swapmb\\t%s\\n' "$(sysctl -n vm.swapusage | awk '{v=$6; sub(/M$/,"",v); printf "%.0f", v+0}')"
df -k /System/Volumes/Data | awk 'NR==2{printf "disk\\t%.0f\\t%.0f\\n", ($2-$4)*1024, $2*1024}'
printf 'up\\t%s\\n' "$(uptime | sed -E 's/.*up ([^,]*(, *[0-9]+:[0-9]+)?).*/\\1/' | sed 's/  */ /g')"
`;

const MEMAPPS = `/usr/bin/python3 "desk-memapps.py"`;
const SWAP_HIGH = 1024, SWAP_BAD = 3072; // MB. Under 1 GB is normal on a 16 GB Mac.

export const refreshFrequency = 10000;
export const initialState = { d: null, showDisk: false, panel: null, apps: null, confirm: null, net: null, rate: null };

const first = (a) => (a && a[0]) || "";
export const updateState = (e, prev) => {
  if (e.type === "TOGGLE_DISK") return { ...prev, showDisk: !prev.showDisk };
  if (e.type === "PANEL") return { ...prev, panel: prev.panel === e.mode ? null : e.mode, confirm: null, apps: null };
  if (e.type === "APPS") return { ...prev, apps: e.apps, confirm: null };
  if (e.type === "LOADING_APPS") return { ...prev, apps: null };
  if (e.type === "CONFIRM") return { ...prev, confirm: e.name };
  if (e.type === "SPEED_START") return { ...prev, testing: true, speedErr: null };
  if (e.type === "SPEED_DONE") return { ...prev, testing: false, speedErr: e.err || null, speedNow: e.line || prev.speedNow };
  if (e.output === undefined) return prev;
  if (e.error) return { ...prev, error: e.error };
  const d = {}, M = { nif: [], port: [], ifup: [] };
  (e.output || "").trim().split("\n").forEach((l) => { const [k, ...v] = l.split("\t"); if (M[k]) M[k].push(v); else d[k] = v; });
  // network speed per interface: bytes since the last refresh / seconds. Counter went backwards (sleep, unplug) = skip it once.
  const now = Date.now();
  const cur = {};
  M.nif.forEach(([n, i, o]) => { cur[n] = [Number(i), Number(o)]; });
  const rates = {};
  let down = 0, up = 0, have = false;
  if (prev.net && now - prev.net.t > 500) {
    const dt = (now - prev.net.t) / 1000;
    for (const n in cur) {
      const p = prev.net.c[n];
      if (p && cur[n][0] >= p[0] && cur[n][1] >= p[1]) {
        rates[n] = { down: (cur[n][0] - p[0]) / dt, up: (cur[n][1] - p[1]) / dt };
        down += rates[n].down; up += rates[n].up; have = true;
      }
    }
  }
  const ports = {};
  M.port.forEach(([dev, name]) => { ports[dev] = name; });
  const ups = M.ifup.map(([dev, media]) => ({ dev, media: media || "", name: ports[dev] || dev }));
  return { ...prev, error: null, d, ports, ups, rates, net: { c: cur, t: now }, rate: have ? { down, up } : null };
};

const GREEN = "#7cc7ad", AMBER = "#e3b25f", RED = "#e98585", BLUE = "#8eaeea", PURPLE = "#b49ae0"; // muted, easy on the eye
const color = (p) => (p >= 85 ? RED : p >= 65 ? AMBER : GREEN);
const gb = (b) => (Number(b) / 1024 ** 3).toFixed(1);
const gbD = (b) => (Number(b) / 1e9).toFixed(1); // disk in decimal GB, same as Finder / About This Mac
const fmtMb = (m) => (m >= 1024 ? `${(m / 1024).toFixed(1)} GB` : `${m} MB`);
const fmtRate = (b) => (b == null ? ["–", ""] : b >= 1e6 ? [(b / 1e6).toFixed(1), "MB/s"] : b >= 1e3 ? [Math.round(b / 1e3), "KB/s"] : [Math.round(b), "B/s"]);
// app name for the one-line summary: drop the maker, long names -> first word, still long -> cut
const short = (n) => {
  let s = String(n || "").replace(/^(Google|Microsoft|Apple) /, "");
  if (s.length > 10) s = s.split(/\s+/)[0];
  return s.length > 10 ? `${s.slice(0, 9)}…` : s;
};
const safe = (s) => String(s).replace(/["$`\\]/g, "");
const THERM = [["cool", GREEN], ["warm", AMBER], ["hot · slowing", RED], ["very hot", RED], ["very hot", RED]];
const FRIENDLY = {
  WindowServer: "screen drawing", kernel_task: "macOS kernel", claude: "Claude Code", backupd: "Time Machine",
  mds_stores: "Spotlight indexing", mds: "Spotlight indexing", mdworker_shared: "Spotlight indexing",
  WallpaperAerialsExtension: "aerial wallpaper", photoanalysisd: "Photos analysis", softwareupdated: "macOS update",
};

export const className = `
  right: 42px; top: 190px; width: 300px;
  font-family: -apple-system, "SF Pro Display", sans-serif; color: #eef1f6; text-align: right; -webkit-font-smoothing: antialiased;
  text-shadow: 0 1px 3px rgba(0,0,0,0.55);
  /* DARK SHADE: dark on the right fading out to the left, so white text reads on any photo. */
  z-index: 0;
  &::before { content: ""; position: absolute; z-index: -1; pointer-events: none; inset: -16px -20px -16px -70px; border-radius: 26px;
    background: linear-gradient(to left, rgba(8,9,12,0.62) 50%, rgba(8,9,12,0.0)); }
  /* /DARK SHADE */
`;

const kick = css`font-size: 9.5px; font-weight: 500; letter-spacing: 1.8px; text-transform: uppercase; color: rgba(238,241,246,0.66);`;
const blk = css`margin-top: 10px;`;
const line = css`display: flex; justify-content: space-between; align-items: baseline;`;
const lab = css`font-size: 9.5px; font-weight: 500; letter-spacing: 1.6px; text-transform: uppercase; color: rgba(238,241,246,0.66);`;
const val = css`font-size: 28px; font-weight: 200; letter-spacing: -0.8px; line-height: 1.1; font-variant-numeric: tabular-nums; color: #eef1f6;`;
const unit = css`font-size: 11px; font-weight: 400; letter-spacing: 0; color: rgba(238,241,246,0.66); margin-left: 3px;`;
const bar = css`display: flex; height: 3px; border-radius: 2px; overflow: hidden; background: rgba(238,241,246,0.20); margin-top: 6px; gap: 1px;`;
const sub = css`font-size: 10.5px; font-weight: 400; color: rgba(238,241,246,0.86); margin-top: 4px; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
// compact ring row (CPU / GPU / Memory)
const ringRow = css`display: flex; justify-content: space-between; align-items: center; margin-top: 10px;`;
const cell = css`display: flex; align-items: center; gap: 7px; text-align: left;`;
const cval = css`font-size: 22px; font-weight: 200; letter-spacing: -0.6px; line-height: 1; font-variant-numeric: tabular-nums; color: #eef1f6;`;
const clab = css`font-size: 8.5px; font-weight: 500; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(238,241,246,0.66); margin-top: 3px;`;
const netRow = css`display: flex; justify-content: space-between; align-items: baseline; margin-top: 10px;`;
const nval = css`font-size: 15px; font-weight: 300; font-variant-numeric: tabular-nums; color: #eef1f6;`;
const btns = css`display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 6px; margin-top: 11px;`;
const gbtn = css`
  display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; padding: 4px 10px; border-radius: 999px; cursor: pointer;
  color: rgba(238,241,246,0.86); background: rgba(0,0,0,0.22); border: 1px solid rgba(238,241,246,0.28); text-shadow: none;
  &:hover { background: rgba(0,0,0,0.45); border-color: rgba(238,241,246,0.6); color: #eef1f6; }
`;
const gOn = css`background: rgba(238,241,246,0.9); color: #14161c; border-color: transparent; &:hover { background: #eef1f6; color: #14161c; }`;
const panelCss = css`
  margin-top: 10px; padding: 9px 11px; border-radius: 12px; text-align: left; text-shadow: none;
  background: rgba(12,13,18,0.80); border: 1px solid rgba(255,255,255,0.08);
`;
const panelHead = css`font-size: 9.5px; font-weight: 600; letter-spacing: 1.1px; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 4px;`;
const appRow = css`display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 11.5px;`;
const appName = css`width: 104px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: rgba(255,255,255,0.88);`;
const appBar = css`flex: 1; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.08); overflow: hidden;`;
const appMb = css`width: 50px; text-align: right; font-variant-numeric: tabular-nums; color: rgba(255,255,255,0.72);`;
const qBtn = css`
  width: 44px; text-align: center; font-size: 10.5px; border-radius: 999px; padding: 2px 0; cursor: pointer;
  color: #ffb3b3; background: rgba(255,107,107,0.12); border: 1px solid rgba(255,107,107,0.3);
  &:hover { background: rgba(255,107,107,0.3); color: #fff; }
`;
const qSure = css`background: rgba(255,107,107,0.55); color: #fff;`;
const qNone = css`width: 44px;`;
const tip = css`font-size: 10px; line-height: 1.45; color: rgba(255,255,255,0.5); margin-top: 6px;`;
const dot = (c) => ({ display: "inline-block", width: 6, height: 6, borderRadius: 3, background: c, marginRight: 5, verticalAlign: "1px" });

const Icon = ({ d, s = 11, w = 2.2 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const LIST = ["M9 6h12", "M9 12h12", "M9 18h12", "M4 6h.01", "M4 12h.01", "M4 18h.01"];
const SPARK = ["M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z", "M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"];
const SWAPI = ["M7 4v16", "M3 16l4 4 4-4", "M17 20V4", "M13 8l4-4 4 4"];
const DRIVE = ["M3 15a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M5 13l2.5-8h9L19 13", "M16.5 16.5h.01"];
const GAUGE = ["M12 14l4-4", "M3.34 19a10 10 0 1 1 17.32 0"];

// connection helpers. Port names come from networksetup ("Wi-Fi", "USB 10/100/1000 LAN", "Thunderbolt Bridge"...).
const SPEEDTEST = `/usr/bin/python3 "desk-speedtest.py"`;
const kindOf = (name) => {
  const n = name || "";
  if (/wi-?fi/i.test(n)) return "Wi-Fi";
  if (/iphone|ipad|android|tether/i.test(n)) return "Phone"; // phone on a USB cable ("iPhone USB")
  if (/thunderbolt|bridge/i.test(n)) return null; // Mac-to-Mac links, not internet
  return n ? "Ethernet" : null; // hub / adapter Ethernet ("USB 10/100/1000 LAN", "AX88179A"...)
};
const linkOf = (media) => { const n = parseInt(media, 10); return n ? (n >= 1000 ? `${n / 1000} Gb` : `${n} Mb`) : ""; };
const ago = (ts) => {
  const s = Date.now() / 1000 - Number(ts);
  return s < 60 ? "just now" : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`;
};

// small ring gauge; segs = [[fraction 0-1, colour], ...] drawn one after another clockwise from the top
const Ring = ({ segs, s = 26, w = 2.6 }) => {
  const r = (s - w) / 2, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ transform: "rotate(-90deg)", flex: "none", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))" }}>
      <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke="rgba(238,241,246,0.20)" strokeWidth={w} />
      {segs.map(([f, c], i) => {
        const len = Math.max(0, Math.min(1, f || 0)) * C;
        const el = <circle key={i} cx={s / 2} cy={s / 2} r={r} fill="none" stroke={c} strokeWidth={w} strokeDasharray={`${len} ${C}`} strokeDashoffset={-acc} />;
        acc += len;
        return el;
      })}
    </svg>
  );
};
const Stat = ({ label, segs, value, u, title }) => (
  <div className={cell} title={title}>
    <Ring segs={segs} />
    <div>
      <div className={cval}>{value}<span className={unit}>{u}</span></div>
      <div className={clab}>{label}</div>
    </div>
  </div>
);

const PANEL_INFO = {
  apps: ["Memory by app", null],
  free: ["Quit an app to free memory", "Quit = same as Cmd+Q (it may ask to save). Click twice to confirm. macOS fills RAM on purpose; act only if pressure turns amber/red."],
  swap: ["Apps holding compressed / swapped memory", "Swap is memory macOS parked on the disk. It clears when the app holding it quits (Chrome: reopen tabs with Cmd+Shift+T), or fully on a restart. Under 1 GB is normal; only act if it keeps growing or pressure turns amber."],
};

export const render = ({ d, error, showDisk, panel, apps, confirm, rate, rates, ports, ups, testing, speedNow, speedErr }, dispatch) => {
  const speedTest = () => {
    if (testing || (d && d.testing)) return;
    dispatch({ type: "SPEED_START" });
    run(SPEEDTEST).then((out) => {
      const l = (out || "").trim();
      if (l.startsWith("speed\t")) dispatch({ type: "SPEED_DONE", line: l.split("\t").slice(1) });
      else dispatch({ type: "SPEED_DONE", err: l === "busy" ? null : (l.replace(/^error\t/, "") || "no result") });
    }).catch(() => dispatch({ type: "SPEED_DONE", err: "could not run" }));
  };
  const loadApps = (mode) => {
    dispatch({ type: "LOADING_APPS" });
    run(mode === "swap" ? `${MEMAPPS} --swap` : MEMAPPS).then((out) => {
      try { const p = JSON.parse(out); dispatch({ type: "APPS", apps: Array.isArray(p) ? p : [] }); } catch (e) { dispatch({ type: "APPS", apps: [] }); }
    });
  };
  const openPanel = (mode) => {
    if (panel !== mode) loadApps(mode);
    dispatch({ type: "PANEL", mode });
  };
  const quit = (name) => {
    if (confirm !== name) return dispatch({ type: "CONFIRM", name });
    const mode = panel;
    dispatch({ type: "LOADING_APPS" });
    run(`${MEMAPPS} --quit "${safe(name)}"`).then(() => setTimeout(() => loadApps(mode), 2500));
  };
  if (error || !d || !d.memtotal) return <div className={kick}>This Mac · loading…</div>;

  const cpu = Number(first(d.cpu)) || 0;
  const [gpuRaw, gpuMem] = (d.gpu || []).map(Number);
  const gpu = gpuRaw || 0;
  const total = Number(first(d.memtotal));
  const app = Number(first(d.app)), wired = Number(first(d.wired)), comp = Number(first(d.comp));
  const used = app + wired + comp;
  const level = Number(first(d.level));
  const pressure = level >= 30 ? ["normal", GREEN] : level >= 15 ? ["high", AMBER] : ["critical", RED];
  const swapMb = Number(first(d.swapmb)) || 0;
  const swapCol = swapMb >= SWAP_HIGH ? (swapMb >= SWAP_BAD ? RED : AMBER) : null;
  const therm = THERM[Number(first(d.therm)) || 0] || THERM[0];
  const [topCraw, topCp] = d.topc || [];
  const topC = FRIENDLY[topCraw] || topCraw;
  const [topM, topMb] = d.topm || [];
  const [dUsed, dTotal] = (d.disk || []).map(Number);
  const [dn, dnU] = fmtRate(rate && rate.down);
  const [upv, upU] = fmtRate(rate && rate.up);
  // which connection macOS is using: the primary interface (higher in Network service order)
  const pdev = first(d.primary);
  const conns = (ups || []).filter((u) => kindOf(u.name));
  const pconn = conns.find((u) => u.dev === pdev);
  const pkind = !pdev ? "offline" : /^(utun|ipsec|ppp)/.test(pdev) ? "VPN" : kindOf((ports || {})[pdev]) || pdev;
  const plink = pconn && pkind === "Ethernet" ? linkOf(pconn.media) : "";
  const slowLink = plink && parseInt(pconn.media, 10) < 1000;
  // speed test: newest of the saved result (cache file) and the one just run
  const saved = d.speed && d.speed.length >= 6 ? d.speed : null;
  const sp = speedNow && (!saved || Number(speedNow[0]) >= Number(saved[0])) ? speedNow : saved;
  const isTesting = testing || !!d.testing;
  const spPath = sp ? (sp[3].startsWith("utun") ? `VPN over ${kindOf(sp[4]) || sp[4]}` : kindOf(sp[4]) || sp[4]) : "";

  return (
    <div>
      <div className={kick} title="macOS heat level; 'hot · slowing' = the Mac is throttling to cool down">
        <span style={{ color: therm[1] }}><span style={dot(therm[1])} />{therm[0]}</span> · up {first(d.up)}
      </div>

      <div className={ringRow}>
        <Stat label="CPU" segs={[[cpu / 100, color(cpu)]]} value={cpu} u="%" title={`CPU · load average ${first(d.load)}`} />
        <Stat label="GPU" segs={[[gpu / 100, color(gpu)]]} value={gpu} u="%"
              title={`GPU busy ${gpu}% · graphics memory in use ${gb(gpuMem || 0)} GB`} />
        <Stat label="Memory" value={gb(used)} u={`/ ${Math.round(total / 1024 ** 3)} GB`}
              segs={[[app / total, BLUE], [wired / total, PURPLE], [comp / total, AMBER]]}
              title={`${gb(used)} GB used of ${Math.round(total / 1024 ** 3)} GB (all usable) · app ${gb(app)} (blue) · system ${gb(wired)} (purple) · compressed ${gb(comp)} GB (amber)`} />
      </div>

      <div className={netRow} title="data moving right now (average of the last 10 s), not the line's top speed. VPN traffic is included, counted once.">
        <span className={lab} title={pconn ? `${(ports || {})[pdev]} (${pdev})${plink ? ` · linked at ${plink}` : ""}` : "no connection"}>
          Network · {pkind}
          {plink && <span style={slowLink ? { color: AMBER } : null} title={slowLink ? "Ethernet linked at under 1 Gb: the hub, port or cable is limiting it" : "Ethernet link speed"}> {plink}</span>}
        </span>
        <span className={nval}>
          <span style={{ color: GREEN }}>↓</span> {dn}<span className={unit}>{dnU}</span>
          <span style={{ marginLeft: 12, color: BLUE }}>↑</span> {upv}<span className={unit}>{upU}</span>
        </span>
      </div>
      {conns.length > 1 && (
        <div className={sub} title="macOS sends traffic through the one 'in use' (the higher one in System Settings → Network → ⋯ → Set Service Order). The other stays connected as backup.">
          {conns.map((u, i) => {
            const r = (rates || {})[u.dev];
            const [v, vu] = fmtRate(r && r.down + r.up);
            return (
              <span key={u.dev} title={`${u.name} (${u.dev})`}>
                {i ? " · " : ""}<span style={dot(u.dev === pdev ? GREEN : "rgba(238,241,246,0.4)")} />
                {kindOf(u.name)} {u.dev === pdev ? "in use" : "standby"} {v} {vu}
              </span>
            );
          })}
        </div>
      )}
      {(isTesting || sp || speedErr) && (
        <div className={sub} title="max speed from macOS's networkQuality test (Mbps = megabits; 1 MB/s ≈ 8 Mbps). With the VPN on, the test goes through the VPN = what you really get.">
          {isTesting ? "testing max speed… ~15 s"
            : speedErr ? <span style={{ color: AMBER }}>speed test failed · {speedErr}</span>
            : <span>max <span style={{ color: GREEN }}>↓</span> {sp[1]} <span style={{ color: BLUE }}>↑</span> {sp[2]} Mbps · {spPath} · {sp[5]} ms · {ago(sp[0])}</span>}
        </div>
      )}

      <div className={sub} style={{ marginTop: 8 }}>
        <span title={`memory pressure: ${pressure[0]} (green normal · amber high · red critical), the real 'is RAM a problem' signal`}>
          <span style={dot(pressure[1])} /><span style={{ color: pressure[1] }}>{pressure[0]}</span>
        </span>
        {" · "}
        <span title="swap: memory parked on the disk. Under 1 GB is normal." style={swapCol ? { color: swapCol } : null}>swap {fmtMb(swapMb)}</span>
        {" · "}
        <span title={`busiest app right now (CPU): ${topC}`}>{short(topC)} {Math.round(Number(topCp) || 0)}%</span>
        {" · "}
        <span title={`app holding the most memory: ${topM} (all its helper processes added up)`}>{short(topM)} {gb(topMb)} GB</span>
      </div>

      {showDisk && dTotal > 0 && (
        <div className={blk}>
          <div className={line}><span className={lab}>Disk</span><span className={val} style={{ fontSize: 20 }} title="free space macOS reports as available (Finder may add 'purgeable' space on top)">{gbD(dTotal - dUsed)}<span className={unit}>GB free</span></span></div>
          <div className={bar}><div style={{ width: `${(dUsed / dTotal) * 100}%`, background: color((dUsed / dTotal) * 100) }} /></div>
          <div className={sub}>used {gbD(dUsed)} of {gbD(dTotal)} GB</div>
        </div>
      )}

      <div className={btns}>
        {swapCol && (
          <span className={`${gbtn} ${panel === "swap" ? gOn : ""}`} style={panel === "swap" ? null : { color: AMBER, borderColor: "rgba(227,178,95,0.5)" }}
                onClick={() => openPanel("swap")} title="see which apps hold the swap">
            <Icon d={SWAPI} />Clear swap
          </span>
        )}
        <span className={`${gbtn} ${panel === "apps" ? gOn : ""}`} onClick={() => openPanel("apps")} title="memory per app"><Icon d={LIST} />Apps</span>
        <span className={`${gbtn} ${panel === "free" ? gOn : ""}`} onClick={() => openPanel("free")} title="quit a big app"><Icon d={SPARK} />Free up</span>
        <span className={`${gbtn} ${isTesting ? gOn : ""}`} onClick={speedTest} title="test the connection's top speed (~15 s, uses some data)"><Icon d={GAUGE} />Speed</span>
        <span className={`${gbtn} ${showDisk ? gOn : ""}`} style={{ width: 26, padding: "4px 0", justifyContent: "center", boxSizing: "border-box" }} onClick={() => dispatch({ type: "TOGGLE_DISK" })} title="Disk"><Icon d={DRIVE} s={12} w={2} /></span>
      </div>

      {panel && (
        <div className={panelCss}>
          <div className={panelHead}>{PANEL_INFO[panel][0]}</div>
          {!apps ? (
            <div className={tip} style={{ marginTop: 0 }}>measuring…</div>
          ) : apps.length === 0 ? (
            <div className={tip} style={{ marginTop: 0 }}>nothing to show</div>
          ) : (
            apps.map((a) => (
              <div className={appRow} key={a.name}>
                <span className={appName} title={`${a.procs} processes`}>{a.name}</span>
                <div className={appBar}>
                  <div style={{ width: `${(a.mb / apps[0].mb) * 100}%`, height: "100%", background: panel === "swap" ? AMBER : BLUE }} />
                </div>
                <span className={appMb}>{fmtMb(a.mb)}</span>
                {panel !== "apps" &&
                  (a.quit ? (
                    <span className={`${qBtn} ${confirm === a.name ? qSure : ""}`} onClick={() => quit(a.name)}>
                      {confirm === a.name ? "Sure?" : "Quit"}
                    </span>
                  ) : (
                    <span className={qNone} />
                  ))}
              </div>
            ))
          )}
          {PANEL_INFO[panel][1] && apps && <div className={tip}>{PANEL_INFO[panel][1]}</div>}
        </div>
      )}
    </div>
  );
};
