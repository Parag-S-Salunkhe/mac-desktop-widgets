// Clock — no card: big thin time straight on the photo (same style as the picture caption), top-right.
// Big time = wherever the Mac is (system time zone); the other zones below with a sun or moon.
// EDIT ZONES: put the places you care about. The one matching the Mac's own zone moves to the big clock.
import { css } from "uebersicht";
export const command = `readlink /etc/localtime | sed 's#.*/zoneinfo/##'`;
export const refreshFrequency = 15000;
const ZONES = [
  { label: "London", tz: "Europe/London" },
  { label: "New York", tz: "America/New_York" },
  { label: "Tokyo", tz: "Asia/Tokyo" },
];
const fmt = (d, tz, opts) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...opts }).format(d);
const offsetKey = (d, tz) => fmt(d, tz, { day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
const hm = (d, tz) => { const [h, m] = fmt(d, tz, { hour: "2-digit", minute: "2-digit", hour12: false }).split(":").map(Number); return { h: h % 24, m }; };
const t12 = (d, tz) => {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(d);
  const get = (k) => (p.find((x) => x.type === k) || {}).value || "";
  return { time: `${get("hour")}:${get("minute")}`, ap: get("dayPeriod").toUpperCase() };
};
const zonesNow = (output) => {
  const now = new Date();
  const localTz = (output || "").trim() || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const k = offsetKey(now, localTz);
  const match = ZONES.find((z) => offsetKey(now, z.tz) === k);
  const others = ZONES.filter((z) => z !== match && offsetKey(now, z.tz) !== k);
  return { now, localTz, localName: match ? match.label : localTz.split("/").pop().replace(/_/g, " "), others,
           localDay: fmt(now, localTz, { weekday: "short" }) };
};
const isDay = (h) => h >= 6 && h < 18;
const Sun = ({ s = 12 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#e3bd62" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="4" fill="#e3bd62" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
const Moon = ({ s = 11 }) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="#9eb0e6"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>);

export const className = `right: 42px; top: 44px; width: 360px;
  font-family: -apple-system, "SF Pro Display", sans-serif; color: #eef1f6; text-align: right; -webkit-font-smoothing: antialiased;
  text-shadow: 0 1px 3px rgba(0,0,0,0.55);
  /* DARK SHADE: dark on the right fading out to the left, so white text reads on any photo. */
  z-index: 0;
  &::before { content: ""; position: absolute; z-index: -1; pointer-events: none; inset: -16px -20px -16px -70px; border-radius: 26px;
    background: linear-gradient(to left, rgba(8,9,12,0.62) 50%, rgba(8,9,12,0.0)); }
  /* /DARK SHADE */
`;
const big = css`font-size: 64px; font-weight: 200; letter-spacing: -2.5px; line-height: 1; font-variant-numeric: tabular-nums;`;
const ap = css`font-size: 14px; font-weight: 400; letter-spacing: 0.5px; margin-left: 6px; color: rgba(238,241,246,0.86);`;
const date = css`font-size: 10.5px; font-weight: 500; letter-spacing: 1.8px; text-transform: uppercase; color: rgba(238,241,246,0.86); margin-top: 5px;`;
const zones = css`display: flex; justify-content: flex-end; gap: 16px; margin-top: 10px; font-size: 13px; font-weight: 400; font-variant-numeric: tabular-nums;`;
const z = css`display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;`;
const zl = css`font-size: 9.5px; font-weight: 500; letter-spacing: 1.3px; text-transform: uppercase; color: rgba(238,241,246,0.66);`;
export const render = ({ output }) => {
  const Z = zonesNow(output);
  const L = t12(Z.now, Z.localTz);
  return (
    <div style={{ position: "relative" }}>
      <div><span className={big}>{L.time}</span><span className={ap}>{L.ap}</span></div>
      <div className={date}>{fmt(Z.now, Z.localTz, { weekday: "long", day: "numeric", month: "long" })} · {Z.localName}</div>
      <div className={zones}>
        {Z.others.map((o) => {
          const T = t12(Z.now, o.tz), H = hm(Z.now, o.tz), d = fmt(Z.now, o.tz, { weekday: "short" });
          return (
            <span className={z} key={o.tz}>
              {isDay(H.h) ? <Sun s={11} /> : <Moon s={10} />}
              <span className={zl}>{o.label}</span>
              <span>{T.time} <span style={{ fontSize: 10, color: "rgba(238,241,246,0.66)" }}>{T.ap}{d !== Z.localDay ? ` ${d}` : ""}</span></span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
