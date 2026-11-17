// About this picture — magazine-style caption on the photo (no card). Daily Bing picture; ‹ › history, ↻ Spotlight,
// ♥ favourite, (i) story, ↗ learn more. Network only once a day (fetch.py is a no-op after that).
import { css, run } from "uebersicht";

const SCRIPT = `/usr/bin/python3 "desk-wallpaper.widget/fetch.py"`;
export const command = SCRIPT;
export const refreshFrequency = 2 * 60 * 1000;
export const initialState = { output: "", open: false, busy: false };
export const updateState = (event, prev) => {
  if (event.type === "TOGGLE") return { ...prev, open: !prev.open };
  if (event.type === "BUSY") return { ...prev, busy: true };
  if (event.output !== undefined)
    return { ...prev, output: event.output, error: event.error, busy: false, open: event.output === prev.output ? prev.open : false };
  return prev;
};
const Icon = ({ d, fill, s = 12, w = 2 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill || "none"} stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
    {d.map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const PREV = ["M15 18l-6-6 6-6"], NEXT = ["M9 18l6-6-6-6"], SHUFFLE = ["M21 12a9 9 0 1 1-2.64-6.36", "M21 3v6h-6"];
const HEART = ["M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"];
const OUT = ["M14 4h6v6", "M20 4l-9 9", "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"];
const PIN = ["M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z", "M12 10.5a1.5 1.5 0 1 0 0-.01"];
const INFO = ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 11v5", "M12 7.5h.01"];
const CAM = ["M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z", "M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"];
const CHEV = ["M6 9l6 6 6-6"];
const SAFE_URL = /^https:\/\/[A-Za-z0-9._~:\/?#\[\]@!&()*+,;=%-]+$/; // no quotes, $, `, \\ or spaces
const parseInfo = (o) => { try { return JSON.parse(o); } catch (e) { return null; } };
const niceDate = (iso) => { const d = new Date(`${iso}T12:00:00`); return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
const actions = (info, busy, dispatch) => ({
  go: (flag) => { if (busy) return; dispatch({ type: "BUSY" }); run(`${SCRIPT} ${flag}`).then((out) => dispatch({ output: out })); },
  // link comes from Bing/Microsoft data: only plain https URLs, passed in single quotes (no shell expansion)
  learn: () => SAFE_URL.test(info.link || "") && run(`open '${info.link}'`),
});

export const className = `
  right: 42px; bottom: 96px; max-width: 440px; text-align: right;
  font-family: -apple-system, "SF Pro Display", sans-serif; color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.55), 0 2px 18px rgba(0,0,0,0.55);
`;
const kicker = css`font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: flex-end;`;
const h = css`font-size: 30px; font-weight: 300; letter-spacing: -0.5px; line-height: 1.1; margin-top: 6px;`;
const pl = css`display: flex; align-items: center; justify-content: flex-end; gap: 5px; font-size: 13px; color: rgba(255,255,255,0.88); margin-top: 5px;`;
const btns = css`display: flex; justify-content: flex-end; gap: 6px; margin-top: 12px;`;
const gb = css`display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
  color: #fff; background: rgba(0,0,0,0.28); border: 1px solid rgba(255,255,255,0.35); &:hover { background: rgba(0,0,0,0.5); border-color: #fff; }`;
const on = css`background: rgba(255,255,255,0.9); color: #111; &:hover { background: #fff; }`;
const story = css`text-align: left; margin-top: 12px; padding: 10px 12px; border-radius: 12px; font-size: 12.5px; line-height: 1.5; text-shadow: none;
  background: rgba(12,13,18,0.78); color: rgba(255,255,255,0.88);`;
const credit = css`font-size: 9.5px; color: rgba(255,255,255,0.55); margin-top: 8px;`;

export const render = ({ output, error, open, busy }, dispatch) => {
  const info = parseInfo(output);
  if (error || !info || info.error) return <div className={kicker}>Picture of the day · waiting for internet…</div>;
  const { go, learn } = actions(info, busy, dispatch);
  return (
    <div>
      <div className={kicker}>{[(info.source || "").startsWith("Bing") ? "Bing" : "Spotlight", busy ? "loading…" : niceDate(info.added || "")].filter(Boolean).join(" · ")}</div>
      <div className={h}>{info.headline}</div>
      {info.place && <div className={pl}><Icon d={PIN} s={12} />{info.place}</div>}
      {open && info.story && <div className={story}>{info.story}<div className={credit} style={{ textShadow: "none" }}>{info.credit}</div></div>}
      <div className={btns}>
        <span className={gb} title="Previous" onClick={() => go("--prev")}><Icon d={PREV} /></span>
        <span className={gb} title="Next" onClick={() => go("--next")}><Icon d={NEXT} /></span>
        <span className={gb} title="New Spotlight picture" onClick={() => go("--new")}><Icon d={SHUFFLE} /></span>
        <span className={gb} title="Favourite" onClick={() => go("--fav")} style={info.fav ? { color: "#ff6b8a" } : null}><Icon d={HEART} fill={info.fav ? "currentColor" : "none"} /></span>
        <span className={`${gb} ${open ? on : ""}`} title="Story" onClick={() => dispatch({ type: "TOGGLE" })}><Icon d={INFO} /></span>
        <span className={gb} title="Learn more" onClick={learn}><Icon d={OUT} /></span>
      </div>
    </div>
  );
};
