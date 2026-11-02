// GitHub の定期実行で、ThemeParks.wiki の /live を1分ごとに MINUTES 分（既定340分、日本時間22:45まで）読み、前回から lastUpdated が変わった行だけを残す（列は tpw_log.py と同じ＋ほかの列の種類）。
//  回が終わるたびに次の回を起動し（collect.yml）、同時に動くのは1本（concurrency）。30分ごとの定期実行は、つながりが切れたときの予備
//  生の値は公開しない約束（ThemeParks.wiki の規約）なので、OUT/tpw/日付/時分.enc に暗号化して置く（鍵は Actions の秘密 TPW_KEY。この PC の pull.py が戻す）
//  ついでに気象庁の大阪府の天気予報を1回読み、OUT/jma/270000/発表時刻.json に置く（すでにあれば save.sh が上書きしない）
//  営業予定（/schedule。公式の開閉園）も起動時に1回読み、暗号化した記録の schedule に入れる（いつの時点でどう発表されていたかを残す。変更の履歴は pull.py が schedule/ に）
//  Powered by ThemeParks.wiki https://themeparks.wiki/
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
const LIVE = "https://api.themeparks.wiki/v1/entity/47f61fac-7586-41ac-ae80-61c9257cf33e/live", SCHED = LIVE.replace(/live$/, "schedule"), JMA = "https://www.jma.go.jp/bosai/forecast/data/forecast/270000.json";
const OUT = process.env.OUT || "out", UA = { "User-Agent": "usj-navi-collector (https://github.com/16king7-ops/usj-navi)" };
const jst = () => new Date(Date.now() + 9 * 3600e3).toISOString().replace("T", " ").slice(0, 19);
const q = v => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const get = async u => { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30e3) }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
// 終わり: MINUTES 分後か、日本時間 22:45 の早いほう。7時前に動いた回は7時まで待ってから読み、22:45 より後なら翌日の7時を待つ。待つだけで MINUTES を使い切ったら何も置かずに終わる
//  回が終わると collect.yml が次の回を起動する（GitHub の定期実行は遅れたりとばされたりして、11/1・11/2 も開園直後と昼すぎに数時間ずつ抜けた）
const close = (() => { const j = new Date(Date.now() + 9 * 3600e3), c = Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate(), 22, 45) - 9 * 3600e3; return Date.now() >= c ? c + 864e5 : c; })(), t7 = close - (15 * 60 + 45) * 60e3;
const end = Math.min(Date.now() + (+process.env.MINUTES || 340) * 60e3, close), seen = {}, rows = [], runs = [], errs = [];
if (Date.now() < t7) { const w = Math.min(t7, end) - Date.now(); console.log("7時まで待つ", Math.round(w / 60e3), "分"); await new Promise(r => setTimeout(r, w)); if (Date.now() < t7) process.exit(0); }
const start = jst();
try {
  const w = await get(JMA), at = w[0].reportDatetime;
  mkdirSync(`${OUT}/jma/270000`, { recursive: true }); writeFileSync(`${OUT}/jma/270000/${at.replace(/:/g, "")}.json`, JSON.stringify(w));
} catch (e) { errs.push(`${jst()} jma ${e.name}: ${e.message}`); }
let schedule = null;
try { schedule = { at: jst(), schedule: (await get(SCHED)).schedule }; } catch (e) { errs.push(`${jst()} schedule ${e.name}: ${e.message}`); }
while (Date.now() < end) {
  const at = jst(), t0 = Date.now();
  try {
    const live = (await get(LIVE)).liveData; let n = 0;
    for (const x of live) {
      const lu = x.lastUpdated || ""; if (seen[x.id] === lu) continue; seen[x.id] = lu; n++;
      const { STANDBY, ...other } = x.queue || {};
      rows.push([at, x.id, x.name, x.entityType, x.status, STANDBY?.waitTime, lu, Object.keys(other).length ? JSON.stringify(other) : ""].map(q).join(","));
    }
    runs.push(`${at},${live.length},${n}`);
  } catch (e) { errs.push(`${at} ${e.name}: ${e.message}`); }
  await new Promise(r => setTimeout(r, Math.max(0, t0 + 60e3 - Date.now())));
}
const dir = `${OUT}/tpw/${start.slice(0, 10)}`, body = gzipSync(JSON.stringify({ cols: "at_jst,entityId,name,entityType,status,waitTime,lastUpdated,otherQueues", rows, runs, errs, schedule }));
mkdirSync(dir, { recursive: true });
execFileSync("openssl", ["enc", "-aes-256-cbc", "-md", "sha256", "-pbkdf2", "-iter", "100000", "-salt", "-pass", "env:TPW_KEY", "-out", `${dir}/${start.slice(11, 16).replace(":", "")}.enc`], { input: body });
console.log(`取得 ${runs.length}回・失敗 ${errs.length}回・行 ${rows.length}`);
if (!runs.length) process.exit(1);
