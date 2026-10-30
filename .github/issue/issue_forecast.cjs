// 予測を発行して固定する（あとで score_issued.cjs で、発行のあとに来た記録と答え合わせする）
//   deno run -A issue_forecast.cjs [--from 2026-10-13] [--to 2026-11-05] [--at 2026-10-22T21:00] [--out issued]
//   deno run -A issue_forecast.cjs --verify issued/20261022-2100   … 保存した入力（input.json.gz）から計算し直して forecast.json と一致するか
// 今のビルド（../../usj_app.html の D と engine.js。engine.js がビルドに入っていなければ止める）で、対象日ごとに乗り物×30分の予測 {med,p10,p90} を作る。
//  既定の対象日は 記録の最後の日の翌日〜発行日の14日後。対象日 <= 発行日（日本時間）は kind:'backfill'（後日固定した過去日。事前に出した予測ではない）
//  天気は入れない（S.wx なし。記録のない日なので天気の補正は 1）・当日の補正（今の待ち）なし・営業時間は D.hours（公式）がある日は公式、ほかは推定
//  基準（base・bn）: 発行時にある記録の直近4週（dataThrough まで）の、同じ平日/休日・同時刻の中央値と日数
// 保存先 <out>/<発行日時>/ は作り直さない（同じフォルダがあれば止める）。forecast.json（予測）と input.json.gz（engine.js と D。写真は除く）
//  --recent recent.js で毎晩の記録（collect/night.py）を足す。--html・--engine で読むアプリと engine.js を変えられる（GitHub の定期実行は公開中の index.html を読む。collect/collect.yml）。
//  --inputs <フォルダ> なら入力は発行ごとに置かず、そのフォルダに中身の sha256 の名前で1回だけ置き、forecast.json の input に発行フォルダからの相対パスを書く
//  --weather JMA.json で、その発行時点に出ていた気象庁予報を対象日の入力に固定する（時刻・出典も保存）。省略時は従来どおり天気入力なし。
//  forecast.json の createdAt は実際に作った時刻。--at が今より前なら既定の issued/ には出さない（--out で別のフォルダに出す確かめ用だけ）。score_issued.cjs は issuedAt と createdAt の遅いほうで何日前を数える
const fs = require("fs"), path = require("path"), vm = require("vm"), zlib = require("zlib"), crypto = require("crypto");
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const sha = s => crypto.createHash("sha256").update(s).digest("hex");
const addD = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
function compute(engine, D, from, to, issuedDay) {
  const ctx = { D, console, localStorage: { getItem: () => null, setItem() {} } };
  vm.createContext(ctx); vm.runInContext(engine, ctx); ctx.__cfg = { from, to, issuedDay };
  return vm.runInContext(`(() => {
    const { from, to, issuedDay } = __cfg, last = DAYS[DAYS.length - 1].d, r1 = v => Math.round(v * 10) / 10, out = [];
    S.wx = D.forecastWeather ? D.forecastWeather.days : {};
    const obs = (x, k, t) => { const m0 = M, h = x.o && x.c ? [x.o, x.c] : hoursOf(x.d); M = { date: x.d, open: h[0], close: h[1] }; try { const a = dayWait0(k, x, t); return a && !a.closed && a.w != null ? a.w : null; } finally { M = m0; } };
    for (let d = from; d <= to; d = addDays(d, 1)) {
      S.date = d; P().over = {}; M = buildModel(d);
      const bd = DAYS.filter(x => x.d > addDays(last, -28) && typOf(x.d) === M.typ && Object.keys(x.s).length), cells = [];
      for (const k of M.keys) {
        const r = RIDES[k]; if (!M.prof[k] || !(r.src === "r" || r.src === "h") || (r.from_ && !fromDay(d))) continue;
        const ts = r.src === "h" ? M.prof[k].map(p => p[0]).filter(t => t >= M.open && t <= M.close) : []; if (r.src === "r") for (let t = Math.max(M.open, r.open || 0) + 30; t <= M.close - 30; t += 30) ts.push(t);
        for (const t of ts) { const p = waitAt(k, t), vs = bd.map(x => obs(x, k, t)).filter(v => v != null); cells.push({ ride: k, src: r.src, t, med: r1(p.med), p10: r1(p.p10), p90: r1(p.p90), base: vs.length ? r1(medOf(vs)) : null, bn: vs.length }); }
      }
      out.push({ targetDate: d, kind: d <= issuedDay ? "backfill" : "forecast", typ: M.typ, open: M.open, close: M.close, hours: D.hours[d] ? "official" : "estimate", crowdAvg: M.crowd.avg, refs: M.crowd.refs.length, cells });
    }
    return JSON.stringify({ dataThrough: last, days: out });
  })()`, ctx);
}
const inputOf = (dir, f) => path.join(dir, f.input || "input.json.gz");
const load = dir => { const f = JSON.parse(fs.readFileSync(path.join(dir, "forecast.json"), "utf8")); return { f, inp: JSON.parse(zlib.gunzipSync(fs.readFileSync(inputOf(dir, f))).toString("utf8")) }; };
if (args.includes("--verify")) {
  const dir = opt("--verify"), { f, inp } = load(dir), ds = f.days.map(x => x.targetDate);
  const hashOk = sha(inp.engine) === f.modelHash && sha(JSON.stringify(inp.D)) === f.dataHash, re = JSON.parse(compute(inp.engine, inp.D, ds[0], ds[ds.length - 1], f.issuedAt.slice(0, 10)));
  const same = hashOk && re.dataThrough === f.dataThrough && JSON.stringify(re.days) === JSON.stringify(f.days);
  console.log(same ? `一致: ${dir}（${ds.length}日・${f.days.reduce((a, x) => a + x.cells.length, 0)}セルを保存した入力から計算し直して同じ）` : `不一致: ${dir}${hashOk ? "" : "（入力の sha256 が forecast.json と違う）"}`);
  process.exit(same ? 0 : 1);
}
const root = path.resolve(__dirname, "../../.."), html = fs.readFileSync(opt("--html", path.join(root, "usj_app.html")), "utf8"), engine = fs.readFileSync(opt("--engine", path.join(__dirname, "..", "engine.js")), "utf8");
if (!html.includes(engine)) { console.error("アプリ（usj_app.html か --html）に今の engine.js が入っていません。先に python _work/攻略アプリ/build_app.py を回してください"); process.exit(1); }
const line = html.slice(html.indexOf("const D = ") + 10).split("\n", 1)[0].trim(), D = { ...JSON.parse(line.slice(0, -1)), photos: {} };
if (opt("--recent", null) && fs.existsSync(opt("--recent"))) {  // 毎晩の記録（collect/night.py の recent.js）を足す。ユニバリアルの記録がある日はそちらを使う
  const R = JSON.parse(fs.readFileSync(opt("--recent"), "utf8").split("=").slice(1).join("=").trim().replace(/;$/, "")), have = new Set(D.days.days.map(x => x.d));
  D.days = { ...D.days, days: [...D.days.days, ...R.days.filter(x => !have.has(x.d))].sort((a, b) => (a.d < b.d ? -1 : 1)) };
}
const now = new Date(Date.now() + 9 * 3600e3).toISOString(), createdAt = now.slice(0, 19) + "+09:00", at = opt("--at", now.slice(0, 16)), issuedDay = at.slice(0, 10), last = D.days.days[D.days.days.length - 1].d;
const from = opt("--from", addD(last, 1)), to = opt("--to", addD(issuedDay, 14)), outDir = path.resolve(opt("--out", path.join(__dirname, "issued"))), dir = path.join(outDir, at.replace(/[-:]/g, "").replace("T", "-"));
if (at < now.slice(0, 16) && outDir === path.resolve(__dirname, "issued")) { console.error(`--at（${at}）が今（${now.slice(0, 16)}）より前です。あとから作った予測を事前の予測として issued/ に置くことはできません（確かめ用に --out で別のフォルダへ出すのはできます）`); process.exit(1); }
if (!(last <= issuedDay)) { console.error(`記録が発行日（${issuedDay}）より先まであるので（${last}）、発行のあとのデータを含みます。--at を直してください`); process.exit(1); }  // 毎晩の発行（23:40）はその日の記録まで使い、予測は翌日から
if (opt("--weather", null)) {
  const w = JSON.parse(fs.readFileSync(opt("--weather"), "utf8")), atWx = w[0] && w[0].reportDatetime, ts = w[0] && w[0].timeSeries && w[0].timeSeries[0];
  if (!Number.isFinite(Date.parse(atWx)) || Date.parse(atWx) > Math.min(Date.parse(at + "+09:00"), Date.now()) || !ts || !Array.isArray(ts.timeDefines) || !ts.areas || !ts.areas[0] || ts.areas[0].area?.code !== "270000" || !Array.isArray(ts.areas[0].weathers)) { console.error("気象庁予報の形式・地域が不正か、予測発行時点より後の予報です"); process.exit(1); }
  const days = {};
  ts.timeDefines.forEach((t, i) => { const d = t.slice(0, 10), text = ts.areas[0].weathers[i]; if (d >= from && d <= to && typeof text === "string" && text.length < 100) days[d] = text; });
  if (!Object.keys(days).length) { console.error("対象日の気象庁予報がありません"); process.exit(1); }
  D.forecastWeather = { at: atWx, source: "https://www.jma.go.jp/bosai/forecast/data/forecast/270000.json", days };
}
fs.mkdirSync(outDir, { recursive: true });
try { fs.mkdirSync(dir); } catch (e) { if (e.code === "EEXIST") { console.error(`発行済みです（上書きしません）: ${dir}`); process.exit(1); } throw e; }
const dj = JSON.stringify(D), res = JSON.parse(compute(engine, D, from, to, issuedDay));
const f = { issuedAt: at + "+09:00", createdAt, dataThrough: res.dataThrough, modelHash: sha(engine), dataHash: sha(dj), inputs: { wx: D.forecastWeather || null, nowcast: false, hoursAt: D.hoursAt || null }, baseline: "直近4週（dataThrough まで）の同じ平日/休日・同時刻の記録の中央値（base）と日数（bn）", tpwIds: D.tpw || {}, days: res.days };
const inDir = opt("--inputs", null), ip = inDir ? path.join(path.resolve(inDir), `${f.modelHash.slice(0, 16)}-${f.dataHash.slice(0, 16)}.json.gz`) : path.join(dir, "input.json.gz");
if (inDir) { fs.mkdirSync(path.dirname(ip), { recursive: true }); f.input = path.relative(dir, ip).split(path.sep).join("/"); }
if (!fs.existsSync(ip)) fs.writeFileSync(ip, zlib.gzipSync(JSON.stringify({ engine, D })));
fs.writeFileSync(path.join(dir, "forecast.json"), JSON.stringify(f));
const fc = f.days.filter(x => x.kind === "forecast");
console.log(`発行: ${dir}\n  記録は ${f.dataThrough} まで・対象 ${from}〜${to}（${f.days.length}日・${f.days.reduce((a, x) => a + x.cells.length, 0)}セル。うち事前の予測 ${fc.length}日${fc.length ? `（${fc[0].targetDate}〜）` : ""}・後日固定 ${f.days.length - fc.length}日）・engine ${f.modelHash.slice(0, 12)}`);
