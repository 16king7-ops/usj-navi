// GitHub の定期実行で、ThemeParks.wiki の /live を1分ごとに MINUTES 分（既定340分、日本時間22:45まで）読み、前回から lastUpdated が変わった行だけを残す（列は tpw_log.py と同じ＋ほかの列の種類）。
//  30分ごとに起動を予約し、同時に動くのは1本（collect.yml の concurrency）。動いた回は22:45まで（最長340分）読み続ける。GitHub の定期実行は1日数回しか動かないことがあったため（2026/10/31〜11/1）
//  生の値は公開しない約束（ThemeParks.wiki の規約）なので、OUT/tpw/日付/時分.enc に暗号化して置く（鍵は Actions の秘密 TPW_KEY。この PC の pull.py が戻す）
//  ついでに気象庁の大阪府の天気予報を1回読み、OUT/jma/270000/発表時刻.json に置く（すでにあれば save.sh が上書きしない）
//  Powered by ThemeParks.wiki https://themeparks.wiki/
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
const LIVE = "https://api.themeparks.wiki/v1/entity/47f61fac-7586-41ac-ae80-61c9257cf33e/live", JMA = "https://www.jma.go.jp/bosai/forecast/data/forecast/270000.json";
const OUT = process.env.OUT || "out", UA = { "User-Agent": "usj-navi-collector (https://github.com/16king7-ops/usj-navi)" };
const jst = () => new Date(Date.now() + 9 * 3600e3).toISOString().replace("T", " ").slice(0, 19);
const q = v => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const get = async u => { const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(30e3) }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
// 終わり: MINUTES 分後か、日本時間 22:45 の早いほう（GitHub の定期実行は遅れたりとばされたりするので、動いた回がその日の終わりまで読み続ける。最長 Actions の6時間の内）。7時前・22:45 より後に動いた回は読まない
const jstNow = () => new Date(Date.now() + 9 * 3600e3), close = (() => { const j = jstNow(); return Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate(), 22, 45) - 9 * 3600e3; })();
const start = jst(), end = Math.min(Date.now() + (+process.env.MINUTES || 340) * 60e3, close), seen = {}, rows = [], runs = [], errs = [];
if (jstNow().getUTCHours() < 7 || Date.now() >= close) { console.log("営業時間外なので読まない", start); process.exit(0); }
try {
  const w = await get(JMA), at = w[0].reportDatetime;
  mkdirSync(`${OUT}/jma/270000`, { recursive: true }); writeFileSync(`${OUT}/jma/270000/${at.replace(/:/g, "")}.json`, JSON.stringify(w));
} catch (e) { errs.push(`${jst()} jma ${e.name}: ${e.message}`); }
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
const dir = `${OUT}/tpw/${start.slice(0, 10)}`, body = gzipSync(JSON.stringify({ cols: "at_jst,entityId,name,entityType,status,waitTime,lastUpdated,otherQueues", rows, runs, errs }));
mkdirSync(dir, { recursive: true });
execFileSync("openssl", ["enc", "-aes-256-cbc", "-md", "sha256", "-pbkdf2", "-iter", "100000", "-salt", "-pass", "env:TPW_KEY", "-out", `${dir}/${start.slice(11, 16).replace(":", "")}.enc`], { input: body });
console.log(`取得 ${runs.length}回・失敗 ${errs.length}回・行 ${rows.length}`);
if (!runs.length) process.exit(1);
