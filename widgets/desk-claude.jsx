// Claude usage — same look as the stats card: text on the photo, "Dark 2" shade, right-aligned.
// Data = desk-claude.py: plan limits + sessions from the files the Claude Code status line writes
// (statusline/claude-statusline.py -> ~/Library/Caches/desk-claude/), open/closed from ~/.claude/sessions.
// Layout: header with today's $ · two rings (5-hour, week) · one line per OPEN session
// (name · context % · $ · green dot = open, glowing = Claude is working) · "closed N ▾" dropdown for ended sessions (24 h).
// Plan limits update on each Claude Code reply; claude.ai / desktop-app use shows after the next one.
import { css } from "uebersicht";

export const command = `/usr/bin/python3 "desk-claude.py"`;
export const refreshFrequency = 15000;
export const initialState = { d: null, showClosed: false };

export const updateState = (e, prev) => {
  if (e.type === "TOGGLE_CLOSED") return { ...prev, showClosed: !prev.showClosed };
  if (e.output === undefined) return prev;
  try { return { ...prev, d: JSON.parse(e.output) }; } catch (err) { return prev; }
};

export const className = `
  right: 42px; width: 300px;
  /* follows the stats card: --stats-bottom is set by desk-system.jsx (fallback = closed-panel position) */
  top: calc(var(--stats-bottom, 344px) + 38px); transition: top 0.25s ease;
  font-family: -apple-system, "SF Pro Display", sans-serif; color: #eef1f6; text-align: right; -webkit-font-smoothing: antialiased;
  text-shadow: 0 1px 3px rgba(0,0,0,0.55);
  /* DARK SHADE (same as desk-system.jsx) */
  z-index: 0;
  &::before { content: ""; position: absolute; z-index: -1; pointer-events: none; inset: -16px -20px -16px -70px; border-radius: 26px;
    background: linear-gradient(to left, rgba(8,9,12,0.62) 50%, rgba(8,9,12,0.0)); }
  /* /DARK SHADE */
`;

const GREEN = "#7cc7ad", AMBER = "#e3b25f", RED = "#e98585", DIM = "rgba(238,241,246,0.66)", FAINT = "rgba(238,241,246,0.5)";
const color = (p) => (p >= 85 ? RED : p >= 65 ? AMBER : GREEN);

const kick = css`font-size: 9.5px; font-weight: 500; letter-spacing: 1.8px; text-transform: uppercase; color: ${DIM};`;
const ringRow = css`display: flex; justify-content: flex-end; gap: 26px; align-items: center; margin-top: 9px;`;
const cell = css`display: flex; align-items: center; gap: 7px; text-align: left;`;
const cval = css`font-size: 22px; font-weight: 200; letter-spacing: -0.6px; line-height: 1; font-variant-numeric: tabular-nums;`;
const unit = css`font-size: 11px; font-weight: 400; letter-spacing: 0; color: ${DIM}; margin-left: 2px;`;
const clab = css`font-size: 8.5px; font-weight: 500; letter-spacing: 1.5px; text-transform: uppercase; color: ${DIM}; margin-top: 3px; white-space: nowrap;`;
const list = css`margin-top: 10px;`;
const row = css`display: flex; justify-content: flex-end; align-items: center; gap: 8px; font-size: 11px; line-height: 1.75; font-variant-numeric: tabular-nums;`;
const nm = css`flex: 0 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
const meta = css`flex: none; color: ${DIM}; font-size: 10.5px;`;
const toggle = css`display: inline-block; margin-top: 4px; font-size: 10px; color: ${DIM}; cursor: pointer; padding: 1px 0;
  &:hover { color: #eef1f6; }`;

const Ring = ({ f, c, s = 26, w = 2.6 }) => {
  const r = (s - w) / 2, C = 2 * Math.PI * r, len = Math.max(0, Math.min(1, f || 0)) * C;
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ transform: "rotate(-90deg)", flex: "none", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))" }}>
      <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke="rgba(238,241,246,0.20)" strokeWidth={w} />
      <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke={c} strokeWidth={w} strokeDasharray={`${len} ${C}`} />
    </svg>
  );
};

const left = (sec) => {
  if (sec <= 0) return "now";
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
};
const ago = (sec) => (sec < 3600 ? `${Math.max(1, Math.round(sec / 60))}m ago` : `${Math.round(sec / 3600)}h ago`);
const hm = (t) => new Date(t * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const tok = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}k`);
const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);
const money = (c) => (c == null ? "" : `$${c < 10 ? c.toFixed(2) : c.toFixed(1)}`);
const dot = (c, glow) => ({ flex: "none", width: 6, height: 6, borderRadius: 3, background: c, opacity: glow ? 1 : 0.75,
  boxShadow: glow ? `0 0 0 2px rgba(124,199,173,0.25), 0 0 8px ${c}` : "none" });

const Limit = ({ label, lim, now }) => {
  if (!lim) return null;
  const reset = lim.resets_at || 0, done = reset && reset <= now;
  const p = done ? 0 : Number(lim.used_percentage) || 0;
  return (
    <div className={cell} title={reset ? `resets ${new Date(reset * 1000).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}` : ""}>
      <Ring f={p / 100} c={color(p)} />
      <div>
        <div className={cval}>{p}<span className={unit}>%</span></div>
        <div className={clab}>{label} · {done ? "reset" : left(reset - now)}</div>
      </div>
    </div>
  );
};

const tip = (s) => `${s.model} · context ${s.ctxUsed ? tok(s.ctxUsed) : "?"} of ${s.ctxSize ? tok(s.ctxSize) : "?"} · ran ${dur(s.mins)} · ${money(s.cost)} API value`;

export const render = ({ d, showClosed }, dispatch) => {
  if (!d) return <div className={kick}>Claude · loading…</div>;
  const now = Date.now() / 1000;
  const L = d.limits, age = L ? now - L.at : 0;
  const open = d.open || [], closed = d.closed || [];

  return (
    <div>
      <div className={kick} title="Plan limits as Claude Code last saw them (they update on each Claude Code reply). $ = API value, not what the plan costs.">
        Claude{L && age > 900 ? ` · as of ${hm(L.at)}` : ""} · today {money(d.todayCost)}
      </div>
      {L ? (
        <div className={ringRow}>
          <Limit label="5-hour" lim={L.five} now={now} />
          <Limit label="week" lim={L.week} now={now} />
        </div>
      ) : (
        <div className={meta} style={{ marginTop: 8 }}>no reading yet — send a message in Claude Code</div>
      )}

      {open.length > 0 && (
        <div className={list}>
          {open.map((s, i) => (
            <div key={i} className={row} title={tip(s)}>
              <span className={nm}>{s.name || "(unnamed session)"}</span>
              <span className={meta}>
                {s.ctx != null && <span style={{ color: color(s.ctx) }}>{Math.round(s.ctx)}%</span>} · {money(s.cost)}
              </span>
              <span style={dot(GREEN, s.busy)} title={s.busy ? "open · Claude is working" : "open · waiting for you"} />
            </div>
          ))}
        </div>
      )}

      {closed.length > 0 && (
        <div>
          <span className={toggle} onClick={() => dispatch({ type: "TOGGLE_CLOSED" })}>
            closed {closed.length} {showClosed ? "▴" : "▾"}
          </span>
          {showClosed && closed.map((s, i) => (
            <div key={i} className={row} style={{ color: FAINT }} title={tip(s)}>
              <span className={nm}>{s.name || "(unnamed session)"}</span>
              <span className={meta} style={{ color: FAINT }}>{money(s.cost)} · {ago(now - s.saved)}</span>
              <span style={{ width: 6, flex: "none" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
