// ================= 共通 =================
const RIDES = D.rides, PH = D.photos, MAPD = D.map, FOOD = D.food;
// 毎晩の記録（recent.js。GitHub の定期実行が ThemeParks.wiki の1分ごとの記録から作る。collect/night.py）を記録に足す。ユニバリアルの記録がある日はそちらを使う
if (typeof window !== "undefined" && window.RECENT && Array.isArray(window.RECENT.days)) { const have = new Set(D.days.days.map(x => x.d)); for (const x of window.RECENT.days) if (x && x.d && !have.has(x.d)) D.days.days.push(x); D.days.days.sort((a, b) => (a.d < b.d ? -1 : 1)); }
const AL = D.days.alpha, SLOT_M = D.days.slots.map(t => +t.slice(0, 2) * 60 + +t.slice(3));
const DAYS = D.days.days, DAYMAP = Object.fromEntries(DAYS.map(x => [x.d, x]));
const hm = m => { m = Math.round(m); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
// 予定の終わり: 閉園より後は 25:57 のような時刻ではなく「閉園後（+n分）」と書く（値は変えない）
const endHm = t => (typeof M !== "undefined" && M && t > M.close ? `閉園後（+${Math.round(t - M.close)}分）` : hm(t));
const dur = m => { m = Math.round(m); return m >= 60 ? `${Math.floor(m / 60)}時間${m % 60 ? (m % 60) + "分" : ""}` : `${m}分`; };
const toMin = s => (s && s.includes(":") ? +s.split(":")[0] * 60 + +s.split(":")[1] : null);
const toHHMM = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const WD = "日月火水木金土";
const dObj = d => new Date(d + "T12:00:00");
const iso = o => `${o.getFullYear()}-${String(o.getMonth() + 1).padStart(2, "0")}-${String(o.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => { const o = dObj(d); o.setDate(o.getDate() + n); return iso(o); };
const md = d => `${+d.slice(5, 7)}/${+d.slice(8)}(${WD[dObj(d).getDay()]})`;
const HOL = new Set(D.holidays);
const isOff = d => HOL.has(d) || [0, 6].includes(dObj(d).getDay());
const typOf = d => (isOff(d) ? "休日" : "平日");
const doy = d => { const o = dObj(d); return Math.round((o - new Date(o.getFullYear(), 0, 1, 12)) / 864e5); };
const inR = (d, rs) => rs.some(([a, b]) => a <= d && d <= b);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const store = { get(k, v) { try { const x = localStorage.getItem("usjapp1-" + k); return x === null ? v : JSON.parse(x); } catch (e) { return v; } },
  set(k, v) { try { localStorage.setItem("usjapp1-" + k, JSON.stringify(v)); return true; } catch (e) { if (!store.failed && typeof onStoreFail === "function") onStoreFail(); store.failed = true; return false; } } };  // 保存できない（容量いっぱい・プライベートブラウズ）ときは一度だけ知らせる
const TODAY = iso(new Date());

// ================= 状態 =================
const S = {
  date: store.get("date", null), sel: store.get("sel", null), must: store.get("must", null), showAt: store.get("showAt", {}),
  foods: store.get("foods", []), wc: store.get("wc", 1), entry: store.get("entry", 0), first: store.get("first", ""),
  slack: store.get("slack", true), style: store.get("style", "lean"), wx: store.get("wx", {}), speed: store.get("speed", 1), plans: store.get("plans", {}), inNin: store.get("inNin", false),
  lightLunch: store.get("lightLunch", false), mealAt: store.get("mealAt", {}), theme: "light", meals: store.get("meals", { lunch: true, dinner: true }),
  tab: "day", planMode: store.get("planMode", "manual"), liveLoc: null, fFrom: store.get("ffrom", null),
};
// 保存データの点検: 前の版の保存や壊れた保存で、なくなった乗り物・型の違う値が残っていても落ちないよう、読み込んだときに直す（直せないものは捨てる）
(() => {
  const isO = v => !!v && typeof v === "object" && !Array.isArray(v), has = (t, k) => typeof k === "string" && Object.hasOwn(t, k), ks = a => (Array.isArray(a) ? a.filter(k => has(RIDES, k)) : null);
  const okIt = it => isO(it) && (["ride", "ticket", "show"].includes(it.type) ? has(RIDES, it.key) : it.type === "food" ? has(FOOD.items, it.key) : ["meal", "wc", "rest"].includes(it.type));
  const its = a => (Array.isArray(a) ? a.filter(okIt).map(it => (typeof it.id === "string" ? it : { ...it, id: "i" + Math.random().toString(36).slice(2, 10) })) : null);
  const byRide = o => (isO(o) ? Object.fromEntries(Object.entries(o).filter(([k]) => has(RIDES, k))) : {});
  if (typeof S.date !== "string" || !/^\d{4}-\d\d-\d\d$/.test(S.date)) S.date = null;
  S.sel = ks(S.sel); S.must = ks(S.must); S.showAt = byRide(S.showAt); S.first = has(RIDES, S.first) ? S.first : "";
  if (![0.8, 1, 1.25].includes(S.speed)) S.speed = 1; if (!Number.isInteger(S.entry) || S.entry < 0 || S.entry > 240) S.entry = 0;
  if (!["lean", "normal", "must", "fast", "sure"].includes(S.style)) S.style = "lean"; if (!["auto", "manual"].includes(S.planMode)) S.planMode = "manual";
  for (const k of ["wx", "mealAt"]) if (!isO(S[k])) S[k] = {}; if (!isO(S.meals)) S.meals = { lunch: true, dinner: true }; if (!Array.isArray(S.foods)) S.foods = [];
  if (!isO(S.plans)) S.plans = {};
  for (const [d, p] of Object.entries(S.plans)) {
    if (!isO(p) || !/^\d{4}-\d\d-\d\d$/.test(d)) { delete S.plans[d]; continue; }
    p.items = its(p.items); p.done = isO(p.done) ? p.done : {}; p.over = byRide(p.over); if (!isO(p.live)) p.live = null;
    for (const k of ["ep", "ticketAt", "closed", "showLive"]) if (k in p) p[k] = byRide(p[k]);
    if ("obs" in p) p.obs = Array.isArray(p.obs) ? p.obs.filter(o => isO(o) && Number.isFinite(o.t) && o.t >= 0 && o.t < 1440 && isO(o.w)).map(o => ({ t: o.t, w: Object.fromEntries(Object.entries(byRide(o.w) || {}).filter(([, v]) => Number.isFinite(v) && v >= 0 && v <= 600)) })).slice(-16) : [];  // 当日の似た日・似た推移に使う読み込みの記録
    if ("manual" in p) { const m = p.manual; if (!isO(m) || !Array.isArray(m.items)) delete p.manual; else { m.items = its(m.items); for (const k of ["want", "wish", "picked"]) if (k in m) m[k] = ks(m[k]) || []; } }
  }
})();
// 予定は日付ごとに持つ（items＝順番、done＝済み、over＝当日に入れた待ち時間、live＝当日モードで組み直した時刻と場所）
const P = () => S.plans[S.date] || (S.plans[S.date] = { items: null, done: {}, over: {}, live: null });
const save = () => { ["date", "sel", "must", "showAt", "foods", "wc", "entry", "first", "slack", "style", "wx", "speed", "plans", "inNin", "lightLunch", "mealAt", "meals", "planMode"].forEach(k => store.set(k, S[k]));  };

// ================= 混み具合（日にち） =================
const AVGS = DAYS.filter(x => x.avg).map(x => x.avg).sort((a, b) => a - b);
const Q = p => AVGS[Math.floor((AVGS.length - 1) * p)];
const QS = [Q(0.25), Q(0.5), Q(0.75)];
const LV = ["空いている", "ふつう", "やや混む", "混む"], LVM = ["◎", "○", "△", "✕"];
const HHN_ALL = [["2025-09-05", "2025-11-03"], ["2026-09-11", "2026-11-08"]];
function refDays(date, need = 6) {
  const typ = typOf(date), y = doy(date), hhn = inR(date, HHN_ALL), big = isBig(date), sp = special(date);
  for (const W of [10, 17, 25, 40]) {
    const r = DAYS.filter(x => x.avg && Object.keys(x.s).length && typOf(x.d) === typ && Math.min(Math.abs(doy(x.d) - y), 365 - Math.abs(doy(x.d) - y)) <= W && x.d !== date
      && (!hhn || inR(x.d, HHN_ALL)) && usable(x) && (big || !isBig(x.d)) && (sp || !special(x.d)));
    if (r.length >= need || W === 40) return r;
  }
}
let excludeDay = null, cutoffDay = null;  // 検証で1日抜くとき／その日より前の記録だけ使うとき（予測の答え合わせ）
const ODD_DAYS = new Set(["2026-10-25"]);  // 台風の日曜など、普段と違う日。似た日・水準の計算には入れない（答え合わせでは実際の値をそのまま見せる）
const usable = x => x.d !== excludeDay && !ODD_DAYS.has(x.d) && (!cutoffDay || x.d < cutoffDay);
const isGap = d => !isOff(d) && isOff(addDays(d, -1)) && isOff(addDays(d, 1));  // 飛び石連休の谷間の平日
// 年パス（スタンダード）の除外日（happyell.co.jp/usj-annualpass-exclusion、2026-10-30 に確認。2025年以前は不明）
//  4日以上続く除外日の1〜3日前の平日（除外日でない）は、年パスの人が「今のうちに」来て混む。前日夜の予測より 人気3つ ×1.18・ほか ×1.09（2026年の6回・17日。
//  1回を抜いて決めた倍率でその回に当てると全体は6回とも改善、17日で −0.82±0.96分・人気3つ −3.67±3.76分。予測検証/yoyride/）
const PASS_EX = [["2026-01-02", "2026-01-04"], ["2026-01-11", "2026-01-11"], ["2026-02-22", "2026-02-22"], ["2026-03-14", "2026-03-16"], ["2026-03-20", "2026-03-30"], ["2026-05-01", "2026-05-06"], ["2026-07-18", "2026-07-20"], ["2026-08-06", "2026-08-23"], ["2026-09-12", "2026-09-13"], ["2026-09-19", "2026-09-28"],
  ["2026-10-03", "2026-10-05"], ["2026-10-10", "2026-10-12"], ["2026-10-17", "2026-10-19"], ["2026-10-23", "2026-10-26"], ["2026-10-30", "2026-11-03"], ["2026-11-07", "2026-11-08"], ["2026-11-21", "2026-11-23"], ["2026-12-19", "2026-12-20"], ["2026-12-25", "2026-12-31"]];
const PRE_EX = { big: 1.18, other: 1.09, BIG: new Set(["ハリウッドドリーム", "バックドロップ", "フライングダイナソー"]) };
const isPassEx = d => inR(d, PASS_EX);
function preExF(date, k) {
  if (isOff(date) || isPassEx(date)) return 1;
  for (let n = 1; n <= 3; n++) { const s = addDays(date, n); if (!isPassEx(s)) continue; let L = 0; while (L < 4 && isPassEx(addDays(s, L))) L++; return L >= 4 ? (PRE_EX.BIG.has(k) ? PRE_EX.big : PRE_EX.other) : 1; }
  return 1;
}
// ===== 似た日の補正（2026/10 予測検証。Opus 5.5・Sonnet 5.5 と調べ、確認期間で効いたものだけ。予測検証/opus/報告.md） =====
//  似た日は「日付の近い同じ曜日の種類の日」のまま。そのうえで、行く日と似た日の違いを3つだけ直す
//   1) 連休の種類（ふつうの週末／3連休の中日／大型連休の中日／連休初日・最終日）の混み方の差
//   2) 営業時間の長さ（USJ が混雑見込みで決めて前もって発表する）の差
//   3) 今年と去年の水準差（直近28日を去年の同じ時期±3日と比べる。乗り物ごとの差は半分だけ効かせる）
//  曜日別・開園時刻・学校の休み・給料日・海外の連休・天気は、効かない／確かめられない／30日前には分からないので使わない
function catOf(d) {
  if (!isOff(d)) return "平日";
  let a = 0, b = 0; while (isOff(addDays(d, -a - 1))) a++; while (isOff(addDays(d, b + 1))) b++;
  const L = a + b + 1; if (L <= 2) return "週末"; if (a && b) return L >= 4 ? "大型中日" : "中日"; return a === 0 ? "連休初日" : "連休最終日";
}
// 年末年始（12/29〜1/3）とお盆（8/13〜8/16）は混み方が別物（12/29・30は大混雑、大みそか・三が日後半は空く）なので、ふつうの日の似た日に入れない
const special = d => d.slice(5) >= "12-29" || d.slice(5) <= "01-03" || (d.slice(5) >= "08-13" && d.slice(5) <= "08-16");
const blkLen = d => { if (!isOff(d)) return 0; let a = 0, b = 0; while (isOff(addDays(d, -a - 1))) a++; while (isOff(addDays(d, b + 1))) b++; return a + b + 1; };
const isBig = d => blkLen(d) >= 4;
// 予測の前提が弱いことの表示用（表示だけで予測は変えない）: 記録の最後の日と何日前か（端末の今日から）／記録が1年分しかない時期（年末年始・GW・お盆）／3日以内なのに天気が未入力
const recordAge = (today = TODAY) => { const last = DAYS[DAYS.length - 1].d; return { last, n: Math.round((dObj(today) - dObj(last)) / 864e5) }; };
const fewPrecedent = d => { const m = d.slice(5); return m >= "12-29" || m <= "01-03" || (m >= "04-29" && m <= "05-06") || (m >= "08-11" && m <= "08-16"); };
const wxMissing = (d, today = TODAY) => { const n = Math.round((dObj(d) - dObj(today)) / 864e5); return n >= 0 && n <= 3 && !(S.wx || {})[d]; };
const _cc = {};
function catFactor(cat) {  // その種類の日の平均待ち ÷ ふつうの週末（日数が少ない種類は4日分だけ1に寄せる）
  if (cat === "平日" || cat === "週末") return 1;
  const key = cat + "|" + cutoffDay + "|" + excludeDay; if (_cc[key] != null) return _cc[key];
  const m = c => { const v = DAYS.filter(x => x.avg && usable(x) && catOf(x.d) === c).map(x => x.avg); return [v.reduce((a, b) => a + b, 0), v.length]; };
  const [s1, n] = m(cat), [sw, nw] = m("週末"), base = sw / Math.max(1, nw);
  return (_cc[key] = n ? (s1 + 4 * base) / (n + 4) / base : 1);
}
// 答え合わせ専用: 予測する日の記録の天気（wx）・営業時間（hours）を見ない（その時点ではまだ分からないので）。アプリでは常に null
let evalBlind = { wx: null, hours: null };
const hoursKnown = d => D.hours[d] || (d !== evalBlind.hours && DAYMAP[d] && DAYMAP[d].o && DAYMAP[d].c ? [DAYMAP[d].o, DAYMAP[d].c] : null);
const hourBin = d => { const h = hoursKnown(d); if (!h) return null; const L = (h[1] - h[0]) / 60; return L <= 10.5 ? "≤10.5h" : L <= 11.5 ? "11h" : L <= 12.5 ? "12h" : L <= 13.5 ? "13h" : "14h"; };
const _fc = {};
function hourEff() {  // 月×平日休日の平均（log）からのずれを、営業時間の長さごとに平均（5日分だけ0に寄せる）
  const key = cutoffDay + "|" + excludeDay; if (_fc[key]) return _fc[key];
  const xs = DAYS.filter(x => x.avg && usable(x)), g = {};
  for (const x of xs) (g[x.d.slice(0, 7) + typOf(x.d)] = g[x.d.slice(0, 7) + typOf(x.d)] || []).push(Math.log(x.avg));
  const gm = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length])), sum = {}, n = {};
  for (const x of xs) { const b = hourBin(x.d); if (!b) continue; const k = typOf(x.d) + b; sum[k] = (sum[k] || 0) + Math.log(x.avg) - gm[x.d.slice(0, 7) + typOf(x.d)]; n[k] = (n[k] || 0) + 1; }
  return (_fc[key] = Object.fromEntries(Object.keys(sum).map(k => [k, sum[k] / (n[k] + 5)])));
}
// 今年と去年の水準の差（T・乗り物ごと）は、去年の日にだけ掛ける。今年の日はもう今年の水準なので掛けない（掛けると直近の日を1割ほど小さく見ていた）
const lastYr = (date, x) => x.d < addDays(date, -200);
function relF(date, x) {  // 似た日 x の値を、行く日 date の条件に直す係数
  const E = hourEff(), a = hourBin(date), b = hourBin(x.d);
  return catFactor(catOf(date)) / catFactor(catOf(x.d)) * (a && b ? Math.exp((E[typOf(date) + a] || 0) - (E[typOf(x.d) + b] || 0)) : 1);
}
// 天気予報: 晴（晴れ・くもり）／時雨（時々雨）／後雨（のち雨）／雨。行く日は画面で選んだ予報（S.wx）、似た日は記録の天気予報欄
const wxClass = w => (!w ? null : /^(雨|大雨|雪)/.test(w) || /暴風/.test(w) ? "雨" : /後(一時)?雨|後雨か雪/.test(w) ? "後雨" : /雨|雪/.test(w) ? "時雨" : "晴");
const wxOf = d => wxClass((S.wx || {})[d] || (DAYMAP[d] && DAYMAP[d].w) || null);
const _wc = {};
function wxEff() {  // 月×平日休日の平均（log）からのずれを天気ごとに平均し、晴れ・くもりとの差にする（日は5日分・乗り物は10日分だけ0に寄せる）
  const key = cutoffDay + "|" + excludeDay; if (_wc[key]) return _wc[key];
  const xs = DAYS.filter(x => x.avg && usable(x) && wxOf(x.d)), mk = x => x.d.slice(0, 7) + typOf(x.d), g = {};
  for (const x of xs) (g[mk(x)] = g[mk(x)] || []).push(Math.log(x.avg));
  const gm = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length])), r = x => Math.log(x.avg) - gm[mk(x)];
  const ds = {}, dn = {}, day = {}, ride = {};
  for (const x of xs) { const k = typOf(x.d) + wxOf(x.d); ds[k] = (ds[k] || 0) + r(x); dn[k] = (dn[k] || 0) + 1; }
  for (const t of ["平日", "休日"]) { const b = (ds[t + "晴"] || 0) / Math.max(1, dn[t + "晴"] || 0); for (const c of ["時雨", "後雨", "雨"]) day[t + c] = ((ds[t + c] || 0) - b * (dn[t + c] || 0)) / ((dn[t + c] || 0) + 5); }
  for (const k of Object.keys(RIDES)) {  // 乗り物: その乗り物の log(平均+10) の 月×平日休日 からのずれ − その日の全体のずれ
    if (RIDES[k].src !== "r" || RIDES[k].from_) continue;
    const gk = {}, vals = [];
    for (const x of xs) { const v = rideMean(x, k); if (v == null) continue; const lv = Math.log(v + 10); vals.push([x, lv]); (gk[mk(x)] = gk[mk(x)] || []).push(lv); }
    const gkm = Object.fromEntries(Object.entries(gk).map(([q, v]) => [q, v.reduce((a, b) => a + b, 0) / v.length])), su = {}, n = {};
    for (const [x, lv] of vals) { const c = wxOf(x.d); su[c] = (su[c] || 0) + lv - gkm[mk(x)] - r(x); n[c] = (n[c] || 0) + 1; }
    const b = (su.晴 || 0) / Math.max(1, n.晴 || 0);
    for (const c of ["時雨", "後雨", "雨"]) ride[k + c] = ((su[c] || 0) - b * (n[c] || 0)) / ((n[c] || 0) + 10);
  }
  return (_wc[key] = { day, ride });
}
// 天気ごとの一時休止: その乗り物の最初〜最後の記録の間で、ほかの乗り物の6割以上には記録があるのにその乗り物だけ抜けた枠（30分）を休止とみる（全部が抜けた時間は記録の都合なので数えない）。
//  { 乗り物: { 天気: { n: 日数, stop: 休止があった日, min: 休止の合計分 } } }。雨の日は屋外の絶叫系の6割前後で止まる（晴れ・くもりは1〜3割。2026/10/28 予測検証/similar）
let _stopR = null;
function stopRates() {
  if (_stopR) return _stopR;
  const out = {};
  for (const x of DAYS) {
    const c = wxClass(x.w), ks = Object.keys(x.s); if (!c || !ks.length || !usable(x)) continue;
    const n = Math.max(...ks.map(k => x.s[k].length)), on = [];
    for (let i = 0; i < n; i++) on.push(ks.filter(k => x.s[k][i] && x.s[k][i] !== ".").length);
    for (const k of ks) {
      const s = x.s[k]; let a = -1, b = -1; for (let i = 0; i < s.length; i++) if (s[i] !== ".") { if (a < 0) a = i; b = i; }
      if (a < 0 || b - a < 5) continue;
      let g = 0; for (let i = a; i <= b; i++) if (s[i] === "." && on[i] >= 0.6 * ks.length) g++;
      const q = ((out[k] = out[k] || {})[c] = out[k][c] || { n: 0, stop: 0, min: 0 }); q.n++; if (g) q.stop++; q.min += g * 30;
    }
  }
  return (_stopR = out);
}
// 雨の日の追加の補正: 天気の補正（似た日の天気との差）を入れても、雨（雨・大雨・暴風）の日はまだ約7%多く見積もっていた（前日夜、2025/10〜2026/10）。
//  前半（〜2026/3）で決めた ×0.93 を後半31日に当てると −0.42±0.54分、後半で決めた ×0.92 を前半13日に当てると −0.41±0.88分（予測検証/mine2/feat.py）
const RAIN_F = 0.93;
const rainF = date => ((S.wx || {})[date] ? wxOf(date) : date !== evalBlind.wx && DAYMAP[date] && DAYMAP[date].w ? wxOf(date) : null) === "雨" ? RAIN_F : 1;
function wxF(date, x, k) {  // 似た日 x の値を、行く日 date の天気予報に直す係数（予報を入れていなければ 1）
  const a = (S.wx || {})[date] ? wxOf(date) : date !== evalBlind.wx && DAYMAP[date] && DAYMAP[date].w ? wxOf(date) : null, b = wxOf(x.d);
  if (!a || !b || a === b) return 1;
  const E = wxEff(), f = (c, t) => (c === "晴" ? 0 : (E.day[t + c] || 0) + (k ? E.ride[k + c] || 0 : 0));
  return Math.exp(WX_G * (f(a, typOf(date)) - f(b, typOf(x.d))));
}
// 天気の補正の強さ。学習した差（5日・10日分0に寄せる）のままだと、雨の日の予測がまだ約14%長かった（2026/10/28 予測検証/similar/diag.py）。
//  1.5倍で雨の日のずれ −0.32±0.23分（43日）、雨でない日は変わらず（2倍は −0.50±0.45 で確認期間の朝が悪化）
const WX_G = 1.5;
const medOf = v => { v = v.slice().sort((a, b) => a - b); return v.length ? v[v.length >> 1] : null; };
const _yc = {};
function yoyPairs() {  // 直近28日の各日と、去年の同じ時期（±3日・同じ曜日の種類）の日
  const end = cutoffDay || addDays(DAYS[DAYS.length - 1].d, 1), key = end + "|" + excludeDay; if (_yc[key]) return _yc[key];
  const out = [];
  for (const x of DAYS) {
    if (!x.avg || !usable(x) || x.d >= end || x.d < addDays(end, -28) || isBig(x.d)) continue;
    const y = doy(x.d), ly = DAYS.filter(z => z.avg && usable(z) && typOf(z.d) === typOf(x.d) && z.d < addDays(x.d, -300) && Math.min(Math.abs(doy(z.d) - y), 365 - Math.abs(doy(z.d) - y)) <= 3);
    if (ly.length) out.push([x, ly]);
  }
  return (_yc[key] = out);
}
// yoyT・yoyRide は似た推移・似た日を探すたびに何千回も呼ばれるので、yoyPairs（締め日ごと）に覚えておく（去年の記録がある9月以降、当日タブが重かった）
const yoyT = () => { const P = yoyPairs(); if (P.T == null) P.T = P.length < 4 ? 1 : medOf(P.map(([x, ly]) => x.avg / medOf(ly.map(z => z.avg * relF(x.d, z))))); return P.T; };
function rideMean(x, k) { const s = x.s[k]; if (!s) return null; const v = []; for (let i = 6; i <= 21; i++) { const w = dec(s, i); if (w != null) v.push(w); } return v.length >= 8 ? v.reduce((a, b) => a + b, 0) / v.length : null; }
function yoyRide(k) {  // 乗り物ごとの補正 = T × (その乗り物の今年÷去年 ÷ T)^0.5（0.6〜1.6）
  const T = yoyT(), P = yoyPairs(); if (P.length < 4) return T;
  const C = (P.ride = P.ride || {}); if (k in C) return C[k];
  let a = 0, na = 0, b = 0;
  for (const [x, ly] of P) { const v = rideMean(x, k); if (v == null) continue; const w = ly.map(z => rideMean(z, k)).filter(v => v != null); if (!w.length) continue; a += v; na++; b += w.reduce((p, q) => p + q, 0) / w.length; }
  return (C[k] = na < 4 || !b ? T : Math.min(1.6, Math.max(0.6, T * Math.pow(a / b / T, 0.5))));
}
// 朝の追加補正: 今年は開園直後の混み方が去年と違うことがある（2026年ホラーナイトは朝一が約2倍。昼以降は同じ）。1日の平均では拾えないので、
//  直近28日の「開園から90分」の平均を、去年の同じ時期と比べ、1日の補正（yoyRide）との差を朝だけ上乗せする（1.0乗・0.7〜2.5倍）
const MORN_MIN = 90;
function mornMean(x, k) { const s = x.s[k]; if (!s || x.o == null) return null; const v = []; for (let i = 0; i < SLOT_M.length; i++) { const m = SLOT_M[i]; if (m >= x.o && m <= x.o + MORN_MIN) { const w = dec(s, i); if (w != null) v.push(w); } } return v.length >= 2 ? v.reduce((a, b) => a + b, 0) / v.length : null; }
const _mc = {};
function morningF(k) {
  const P = yoyPairs(); if (P.length < 4) return 1;
  const key = (cutoffDay || "") + "|" + excludeDay + "|" + k + "|" + P.length; if (_mc[key] != null) return _mc[key];
  let a = 0, na = 0, b = 0;
  for (const [x, ly] of P) { const v = mornMean(x, k); if (v == null) continue; const w = ly.map(z => mornMean(z, k)).filter(q => q != null); if (!w.length) continue; a += v; na++; b += w.reduce((p, q) => p + q, 0) / w.length; }
  const r = na < 6 || !b || a < 8 * na ? 1 : Math.min(2.5, Math.max(0.7, Math.pow(a / b / yoyRide(k), 1.0)));
  return (_mc[key] = r);
}
// 予測の幅: 似た日の値を log(待ち+10) にして、平均と標準偏差から「次の1日」が入る80%の範囲（似た日が少ないほど広い・t分布）。
//  0.25 は年ごとの水準差などの上乗せ（log の標準偏差）。中央値はそのまま
const T90 = [0, 3.08, 1.89, 1.64, 1.53, 1.48, 1.44, 1.41, 1.40, 1.38, 1.37, 1.36, 1.36, 1.35, 1.35, 1.34, 1.34, 1.33, 1.33, 1.33, 1.33];
function bandOf(v, s0 = 0.25) {
  const med = pct(v, 0.5), L = v.map(w => Math.log(w + 10)), n = L.length, m = L.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(L.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  const sp = (T90[n - 1] || 1.28) * Math.sqrt(sd * sd * (1 + 1 / n) + s0 * s0), c = Math.log(med + 10);
  return [med, Math.max(0, Math.min(med, Math.exp(c - sp) - 10)), Math.max(med, Math.exp(c + sp) - 10)];
}
// 重み付きの bandOf（vw = [[値, 重み], …]）。重みが全部同じなら bandOf と同じ。広がりは有効な日数（Σw)²/Σw² で数える
function wq(vw, p) { const s = vw.slice().sort((a, b) => a[0] - b[0]), T = s.reduce((a, b) => a + b[1], 0); let c = 0; for (const [v, w] of s) { c += w; if (c >= p * T) return v; } return s[s.length - 1][0]; }
function bandW(vw, s0) {
  if (vw.every(q => q[1] === vw[0][1])) return bandOf(vw.map(q => q[0]).sort((a, b) => a - b), s0);
  const med = wq(vw, 0.5), W = vw.reduce((a, b) => a + b[1], 0), W2 = vw.reduce((a, b) => a + b[1] * b[1], 0), ne = Math.max(2, W * W / W2);
  const m = vw.reduce((a, [v, w]) => a + w * Math.log(v + 10), 0) / W, va = vw.reduce((a, [v, w]) => a + w * (Math.log(v + 10) - m) ** 2, 0) / W * ne / (ne - 1);
  const sp = (T90[Math.round(ne) - 1] || 1.28) * Math.sqrt(va * (1 + 1 / ne) + s0 * s0), c = Math.log(med + 10);
  return [med, Math.max(0, Math.min(med, Math.exp(c - sp) - 10)), Math.max(med, Math.exp(c + sp) - 10)];
}
function isMiddle(d) { return isOff(d) && isOff(addDays(d, -1)) && isOff(addDays(d, 1)) && (HOL.has(d) || HOL.has(addDays(d, -1)) || HOL.has(addDays(d, 1))); }
const crowdCache = {}, lvOf = avg => (avg == null ? 1 : avg <= QS[0] ? 0 : avg <= QS[1] ? 1 : avg <= QS[2] ? 2 : 3);
// 去年の同じ月日の記録（前例1回の日に、予測と並べて実際の値を見せる／年末年始・お盆の営業時間に使う）。予測そのものは変えない（年末年始・GW・お盆は記録が1年分しかなく、去年の同じ日を使う予測を答え合わせできないため）
const lastYearDay = d => DAYMAP[(+d.slice(0, 4) - 1) + d.slice(4)];
// 年末年始・お盆は日ごとに営業時間が大きく違う（2025/12/31 は 9:00〜17:00、2026/1/3 は 19:00 閉園）ので、去年の同じ月日の開閉園をそのまま使う（公式が出たら D.hours が優先。カウントダウンで夜中に開いていた日は使わない）
const lyHours = d => { const y = special(d) && lastYearDay(d); return y && usable(y) && y.o >= 360 && y.c ? [y.o, y.c] : null; };
// 前日の外れの持ち越し: 前日の記録があれば、前日の実際の平均待ち ÷（前日より前の記録で作った前日の予測）を0.26乗して掛ける（0.7〜1.5倍）。
//  パーク全体の外れは翌日に相関 +0.26 で残る（2日後 +0.07）。答え合わせ（予測検証/similar/、前日夜）: 日の平均待ちのずれ 9.03→8.68（−0.35±0.30、調整・確認とも縮む）、乗り物 −0.10・−0.13分。0.5乗は悪化
const DAY_CARRY = 0.26;
function dayCarry(date) {
  const y = addDays(date, -1), x = DAYMAP[y]; if (!x || !x.avg || !usable(x) || (cutoffDay && y >= cutoffDay)) return 1;
  const keep = cutoffDay; let p; cutoffDay = y; try { p = crowd(y, true).avg; } finally { cutoffDay = keep; }
  return p ? Math.min(1.5, Math.max(0.7, Math.pow(x.avg / p, DAY_CARRY))) : 1;
}
function crowd(date, noCarry = false) {
  if (crowdCache[date] && !excludeDay && !cutoffDay && !noCarry) return crowdCache[date];
  const refs = refDays(date), T = yoyT(), cf = noCarry ? 1 : dayCarry(date), v = refs.map(x => x.avg * relF(date, x) * (lastYr(date, x) ? T : 1) * wxF(date, x, null)).sort((a, b) => a - b), avg = v.length ? Math.round(v[Math.floor(v.length / 2)] * cf) : null;
  const lv = lvOf(avg);
  const mid = isMiddle(date) || isGap(date);
  const res = { avg, lv, refs, mid, gap: isGap(date), n: v.length, cf };
  if (!excludeDay && !cutoffDay) crowdCache[date] = res;
  return res;
}
// 乗れる数の目安: 人気の乗り物（絶叫・ホラー）を空く時間を選んで回り、食事を2回はさむと、開園〜閉園で何回乗れるか。
//  （営業時間 − 食事100分）÷（日の平均待ち×0.57 ＋ 歩く・乗る18分）。計画（planMain）で40日組んだ数とのずれは平均0.5回（予測検証/nov3_1022/rides_calib.cjs）
const ridesOf = d => { const a = crowd(d).avg, h = hoursOf(d); return a ? Math.max(1, Math.round((h[1] - h[0] - 100) / (0.57 * a + 18))) : null; };
function hoursOf(date) {
  if (D.hours[date]) return D.hours[date];
  const ly = lyHours(date); if (ly) return ly;
  const refs = crowd(date).refs, cnt = {};
  for (const x of refs) if (x.o && x.c) { const k = x.o + "-" + x.c; cnt[k] = (cnt[k] || 0) + 1; }
  const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0].split("-").map(Number) : [540, 1260];
}
const eventsOf = d => D.events.filter(e => e[0] <= d && d <= e[1]).map(e => e[2]);
const avail = (k, d) => { const r = RIDES[k]; return (!r.avail || inR(d, r.avail)) && (!r.not_in || !inR(d, r.not_in)); };

// ================= 待ち時間モデル（選んだ日） =================
let M = null;
const dec = (s, i) => (s && s[i] && s[i] !== "." ? AL.indexOf(s[i]) * 5 : null);
// 開園が遅い日は午前の点が午後の点と重なるので、時刻順に並べて同じ時刻はまとめる
function mergePts(pts) {
  pts.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const q of pts) { const L = out[out.length - 1]; if (L && Math.abs(L[0] - q[0]) < 15) { for (let j = 1; j < 4; j++) L[j] = Math.round((L[j] + q[j]) / 2); } else out.push(q.slice()); }
  return out;
}
const pct = (v, p) => v[Math.min(v.length - 1, Math.max(0, Math.round((v.length - 1) * p)))];
// 借りた記録（from_）が使えるのは2025年秋だけ（ジョーズの夜の部。2026年はふだんのジョーズが夕方で終わる）
const fromDay = d => d >= "2025-09-05" && d <= "2025-11-03";
// 閉園が行く日より早かった日は、乗り物も閉園につられて早く終わっただけ。受付終了を閉園の差だけ後ろにずらす（閉園の1時間前より後に終わった日だけ。イベントで夕方に終わる乗り物はそのまま）
const closeShift = (x, last, close) => (x.c && x.c < close && last >= x.c - 60 ? last + (close - x.c) : last);
// ===== 7年分の1時間平均（D.hist7。usjinfo の2019〜2025-08、コロナ期間除く。予測検証/multiyear/exp7.py） =====
//  行く日が先のときだけ、過去の年の同じ時期・同じ平日／休日の日の1時間平均（混み具合は直前28日の水準の比で合わせる、重み exp(−日数差/14)・±30日、重み付き中央値）を混ぜる。
//  混ぜる割合は、記録の最後の日から行く日までの日数（lead）で: 1日以下 0・7日 0.25・14日以上 0.5（その間は直線）。
//  答え合わせ（前半 2025/9〜2026/3 で割合を決め、後半 2026/4〜10 で確認。1時間平均のずれ）: 前日 −0.03（使わない）、7日前 −0.32±0.16、14日前 −0.66±0.30、約1か月前 −1.21±0.48 分
const HIST = (typeof D !== "undefined" && D.hist7) || { keys: [], days: {} }, HK = Object.fromEntries((HIST.keys || []).map((k, i) => [k, i]));
const MAIN7 = ["ハリーポッター", "フライングダイナソー", "ハリウッドドリーム", "バックドロップ", "ミニオンライド", "ジュラシックパーク", "ヒッポグリフ", "ジョーズ"];
const H7W = lead => (lead <= 1 ? 0 : lead <= 7 ? 0.25 * (lead - 1) / 6 : lead <= 14 ? 0.25 + 0.25 * (lead - 7) / 7 : 0.5);
const _hh = {};
function histHour(d, k) {  // その日・乗り物の1時間平均 {時: 分}。2025-09 より前は usjinfo、以降は記録の H:15 と H:45 の平均
  const key = d + "|" + k; if (key in _hh) return _hh[key];
  let out = null; const s = HIST.days[d];
  if (s) { if (HK[k] != null) { out = {}; const g = s.substr(HK[k] * 16, 16); for (let i = 0; i < 16; i++) if (g[i] !== ".") out[7 + i] = AL.indexOf(g[i]) * 5; } }
  else { const x = DAYMAP[d]; if (x && x.s[k]) { const sh = (x.o || 480) - 480, rec = {}; for (let i = 0; i < SLOT_M.length; i++) { const v = dec(x.s[k], i); if (v != null) rec[SLOT_M[i] < 720 ? SLOT_M[i] + sh : SLOT_M[i]] = v; } out = {}; for (let h = 7; h <= 22; h++) { const a = rec[h * 60 + 15], b = rec[h * 60 + 45]; if (a != null && b != null && a + b > 0) out[h] = (a + b) / 2; } } }
  return (_hh[key] = out);
}
const H7DAYS = [...Object.keys(HIST.days), ...DAYS.map(x => x.d)].filter((d, i, a) => a.indexOf(d) === i).sort();
const _lv7 = {};
function lev7(d) {  // その日の水準: 主な乗り物の10〜18時の1時間平均の平均（20個以上あるとき）
  if (d in _lv7) return _lv7[d];
  const v = []; for (const k of MAIN7) { const h = histHour(d, k); if (h) for (let t = 10; t <= 18; t++) if (h[t] != null) v.push(h[t]); }
  return (_lv7[d] = v.length >= 20 ? v.reduce((a, b) => a + b, 0) / v.length : null);
}
const ok7 = d => !ODD_DAYS.has(d) && d !== excludeDay && (!DAYMAP[d] || usable(DAYMAP[d]));
function winLev7(d, lead) { const v = []; for (let i = 1; i <= 28; i++) { const e = addDays(d, -lead - i); if (ok7(e)) { const l = lev7(e); if (l != null) v.push(l); } } return v.length >= 10 ? v.reduce((a, b) => a + b, 0) / v.length : null; }
// 記録の最後の日から行く日までの日数（0＝前日までの記録で翌日を予測）
const leadOf = date => { const lr = cutoffDay ? addDays(cutoffDay, -1) : DAYS[DAYS.length - 1].d; return Math.max(0, Math.round((dObj(date) - dObj(lr)) / 864e5) - 1); };
// 予測の幅（p10〜p90）の倍率: 過去の外れ方に合わせて、真ん中からの上側・下側の幅を ln(待ち+10) で何倍にするか（予測検証/multiyear/interval.py。前半 〜2026-03 で決め、後半で確認）。
//  前日 上0.86・下0.85（後半 入った87→81%・平均の幅46.8→39.6分・Winkler −2.14±0.62）、7・14日前は1（効かない／悪化）、30日前 上0.81・下0.65（89→77%・62.9→46.9分・−4.26±1.36）。間は直線
const BANDK = [[1, 0.86, 0.85], [7, 1, 1], [14, 1, 1], [30, 0.81, 0.65]];
function bandK(lead) { const T = BANDK; if (lead <= T[0][0]) return T[0].slice(1); for (let i = 1; i < T.length; i++) if (lead <= T[i][0]) { const [a, u0, l0] = T[i - 1], [b, u1, l1] = T[i], f = (lead - a) / (b - a); return [u0 + (u1 - u0) * f, l0 + (l1 - l0) * f]; } return T[T.length - 1].slice(1); }
const _p7 = {};
function p7Of(date) {  // { w: 混ぜる割合, v: { 乗り物: { 時: 分 } } } か null
  const lr = cutoffDay ? addDays(cutoffDay, -1) : DAYS[DAYS.length - 1].d, lead = leadOf(date), w = H7W(lead), key = date + "|" + lr + "|" + excludeDay;
  if (key in _p7) return _p7[key];
  const done = r => (_p7[key] = r);
  if (!w || !HIST.keys.length) return done(null);
  const cut = addDays(date, -lead), L0 = winLev7(date, lead); if (L0 == null) return done(null);
  const y = doy(date), dd = x => { const a = Math.abs(doy(x) - y); return Math.min(a, 365 - a); }, cands = [];
  for (const x of H7DAYS) {
    if (x >= cut || !ok7(x) || isOff(x) !== isOff(date) || special(x) !== special(date) || dd(x) > 30 || lev7(x) == null) continue;
    const Lx = winLev7(x, lead); if (Lx != null) cands.push([x, Math.exp(-dd(x) / 14), L0 / Lx]);
  }
  if (cands.length < 5) return done(null);
  const v = {};
  for (const k of Object.keys(RIDES)) {
    if (RIDES[k].src !== "r") continue;
    for (let h = 7; h <= 22; h++) {
      const vw = []; for (const [x, wt, f] of cands) { const hh = histHour(x, k); if (hh && hh[h] != null) vw.push([hh[h] * f, wt]); }
      if (vw.length >= 4) (v[k] = v[k] || {})[h] = wq(vw, 0.5);
    }
  }
  return done({ w, v });
}
// ===== 1日の水準の機械学習（7年分。予測検証/mine2/daymodel.py） =====
//  その日の水準（主な8つの10〜18時の平均）÷ 直近28日（予測した時点まで）を、暦・連休の形・ホラーナイトの何日目・年パス除外日・天気で当てる（LightGBM）。
//  似た日から作った予測の水準と ln で 7:3 に混ぜ、その倍率を全部の乗り物に掛ける。1週間先まで（そこから2週間先へ0に下げる）。前日夜用（3日先まで）と1週間前用の2つ
//  答え合わせ（2026年1〜10月の各月をその月より前で学んで当てる）: 1日の水準のずれ 前日夜 0.147→0.137（前半 −0.008・後半 −0.011）、7日前 0.160→0.152（−0.010・−0.007）。14日前は効かない
const DM_MODEL = (typeof D !== "undefined" && D.daymodel) || null;
function dayFeat(d, lead) {
  const o = dObj(d), off = isOff, run = e => { if (!off(e)) return [0, 0, 0]; let a = 0, b = 0; while (off(addDays(e, -a - 1))) a++; while (off(addDays(e, b + 1))) b++; return [a + b + 1, a, b]; };
  const [n, a, b] = run(d), nxt = (() => { for (let i = 1; i < 15; i++) if (off(addDays(d, i))) return i; return 15; })(), prv = (() => { for (let i = 1; i < 15; i++) if (off(addDays(d, -i))) return i; return 15; })();
  const hs = HHN_ALL.find(([s, e]) => s <= d && d <= e), days = (x, y) => Math.round((dObj(y) - dObj(x)) / 864e5);
  const wx = e => { const w = (S.wx || {})[e] ? wxOf(e) : lead <= 7 && e !== evalBlind.wx && DAYMAP[e] && DAYMAP[e].w ? wxOf(e) : null; return w == null ? NaN : { 雨: 3, 後雨: 2, 時雨: 1, 晴: 0 }[w]; };
  const md = (o.getMonth() + 1) * 100 + o.getDate();
  return [doy(d) + 1, (o.getDay() + 6) % 7, off(d) ? 1 : 0, n, a, b, nxt, prv, nxt < 15 ? run(addDays(d, nxt))[0] : 0, hs ? days(hs[0], d) : -1, hs ? days(d, hs[1]) : -1,
    d.startsWith("2026") ? (isPassEx(d) ? 1 : 0) : NaN, wx(d), wx(addDays(d, 1)), md >= 1220 || md <= 107 ? 1 : 0, md >= 320 && md <= 407 ? 1 : 0, md >= 720 && md <= 831 ? 1 : 0, o.getDate()];
}
function dayMLF(date, prof, open, close) {
  if (!DM_MODEL || !HIST.keys.length) return 1;
  const lead = leadOf(date), w = lead <= 7 ? 0.3 : lead < 14 ? 0.3 * (14 - lead) / 7 : 0, mdl = DM_MODEL[lead <= 3 ? "l0" : "l7"];
  if (!w || !mdl) return 1;
  const base = winLev7(date, lead); if (base == null) return 1;
  const at = (p, t) => { if (t <= p[0][0]) return p[0][1]; for (let i = 1; i < p.length; i++) if (t <= p[i][0]) return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * (t - p[i - 1][0]) / Math.max(1, p[i][0] - p[i - 1][0]); return p[p.length - 1][1]; };
  const v = []; for (const k of MAIN7) { const p = prof[k]; if (!p || p.length < 2) continue; for (let t = Math.max(600, open + 30); t <= Math.min(1140, close - 30); t += 30) v.push(at(p, t)); }
  if (v.length < 20) return 1;
  const app = v.reduce((s, x) => s + x, 0) / v.length, f = dayFeat(date, lead), ml = Math.exp(mdl.trees.reduce((s, tr) => s + mlTree(tr, f), 0)) * base;
  return Math.min(1.4, Math.max(0.7, Math.pow(ml / app, w)));
}
// ===== 乗り物ごとの1日の形の機械学習（7年分。予測検証/score/shapemodel.py） =====
//  その乗り物のその時の待ちが、その日の10〜18時の平均の何倍か（ln(+10)）を、乗り物・時・暦・連休・ホラーナイト・除外日・天気（dayFeat）で当てる。
//  水準は今の予測のまま、各時刻の値を ln(+10) で 7:3 に混ぜる。前日夜（3日先まで）だけ
//  答え合わせ（記録の時刻だけ、2026年1〜10月の各月をその月より前で学ぶ、±10分か±10%）: 全体 58.9→59.8%（前半 +1.1・後半 +0.7）、人気4つ 47.0→47.6%、ドンキー 44.7→46.1、マリオカート 40.8→40.5
const SH_MODEL = (typeof D !== "undefined" && D.shapemodel) || null, SH_W = 0.3;
function shapeF(date, prof, open, close, keys) {
  if (!SH_MODEL || !HIST.keys.length) return;
  const lead = leadOf(date); if (lead > 3) return;
  const f0 = dayFeat(date, lead), rides = new Set(SH_MODEL.rides);
  const at = (p, t) => { if (t <= p[0][0]) return p[0][1]; for (let i = 1; i < p.length; i++) if (t <= p[i][0]) return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * (t - p[i - 1][0]) / Math.max(1, p[i][0] - p[i - 1][0]); return p[p.length - 1][1]; };
  for (const k of keys) {
    const p = prof[k]; if (RIDES[k].src !== "r" || !rides.has(k) || !p || p.length < 2) continue;
    const v = []; for (let t = Math.max(600, open + 15); t <= Math.min(1140, close - 15); t += 30) v.push(at(p, t));
    if (v.length < 6) continue;
    const L = v.reduce((s, x) => s + x, 0) / v.length, sh = {};
    prof[k] = p.map(q => {
      const h = Math.floor(q[0] / 60); if (!(h in sh)) sh[h] = SH_MODEL.trees.reduce((s, tr) => s + mlTree(tr, [k, h, ...f0]), 0);
      const ml = Math.max(0, (L + 10) * Math.exp(sh[h]) - 10), m = Math.exp(SH_W * Math.log(ml + 10) + (1 - SH_W) * Math.log(q[1] + 10)) - 10, r = q[1] > 0 ? Math.max(0, m) / q[1] : 1;
      return [q[0], q[1] * r, q[2] * r, q[3] * r, ...q.slice(4)];
    });
  }
}
// 時期限定の局所補正。全体の水準（日の混み方・dayMLF）と形を作った後の「残るずれ」を直す。
// 現時点で有効にする範囲は、検証したHHN期間の人気4機種。同条件の過去日だけで再計算し、
// 同じ時間帯で2日以上、同方向に30分以上外れていた部分に中央値の半分を加える。
const MICRO = { enabled: true, days: 28, count: 3, threshold: 30, weight: 0.5,
  rides: new Set(["ハリウッドドリーム", "バックドロップ", "フライングダイナソー", "ハリーポッター"]) };
let _microBusy = false;
const _microPast = new Map();
const microMedian = v => { v = v.slice().sort((a, b) => a - b); return (v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2; };
function microContext(d) {
  return JSON.stringify([-1, 0, 1].map(n => { const e = addDays(d, n); return [isOff(e), isPassEx(e)]; }).concat([
    inR(d, HHN_ALL), preExF(d, "ハリーポッター") > 1, eventsOf(d).slice().sort().join("|")
  ]));
}
function microPast(x) {
  const key = x.d + "|" + DAYS.length + "|" + HIST.keys.length;
  if (_microPast.has(key)) return _microPast.get(key);
  const keep = { M, cutoffDay, excludeDay, evalBlind, busy: _microBusy, wx: S.wx };
  let out;
  try {
    _microBusy = true; cutoffDay = x.d; excludeDay = null; evalBlind = { wx: null, hours: null }; S.wx = {};
    M = buildModel(x.d); out = { open: M.open, rows: {}, actual: {} };
    for (const k of MICRO.rides) {
      const s = x.s[k]; if (!s || !M.prof[k]) continue;
      const rows = {}, actual = {};
      for (let i = 0; i < SLOT_M.length; i++) {
        const a = dec(s, i), t = SLOT_M[i] < 720 ? SLOT_M[i] + M.open - 480 : SLOT_M[i];
        if (a != null && t >= M.open && t <= M.close) { rows[t] = a - baseAt(k, t).med; actual[t] = a; }
      }
      out.rows[k] = rows; out.actual[k] = actual;
    }
  } finally { M = keep.M; cutoffDay = keep.cutoffDay; excludeDay = keep.excludeDay; evalBlind = keep.evalBlind; _microBusy = keep.busy; S.wx = keep.wx; }
  _microPast.set(key, out); return out;
}
function microValues(refs, k, time, open, field = "rows") {
  const past = [];
  for (const x of refs) {
    const b = microPast(x), rows = b[field][k]; if (!rows) continue;
    const t = time < open + 90 ? b.open + time - open : time;
    const at = [t, t - 15, t + 15].find(t => rows[t] != null); if (at == null) continue;
    past.push({ d: x.d, v: rows[at] }); if (past.length >= MICRO.count) break;
  }
  return past;
}
function microApply(date, prof, open, beforeMicro = {}) {
  const applied = {};
  if (!MICRO.enabled || _microBusy || excludeDay || leadOf(date) > 3 || !inR(date, HHN_ALL) || !PASS_EX.some(([s]) => s.slice(0, 4) === date.slice(0, 4))) return applied;
  const context = microContext(date), refs = DAYS.filter(x => x.d < date && x.d >= addDays(date, -MICRO.days) && usable(x) && microContext(x.d) === context).slice().reverse();
  // HHNの土曜夕方は、雨の減少を掛けすぎて直近の土曜実績より低くなる場合も直す。
  // 同じ曜日・除外日・イベント構成の実際の曲線へ半分だけ寄せる。過去の残差とは重ね足ししない。
  const saturday = dObj(date).getDay() === 6 && isPassEx(date), events = eventsOf(date).slice().sort().join("|");
  const satRefs = saturday ? DAYS.filter(x => x.d < date && x.d >= addDays(date, -MICRO.days) && usable(x) && dObj(x.d).getDay() === 6 && isPassEx(x.d) && eventsOf(x.d).slice().sort().join("|") === events).slice().reverse() : [];
  if (refs.length < 2 && satRefs.length < 2) return applied;
  for (const k of MICRO.rides) {
    const p = prof[k]; if (!p) continue;
    for (const q of p) {
      let past = microValues(refs, k, q[0], open), delta = 0, kind = "repeated-error";
      if (past.length >= 2) {
        const e = microMedian(past.map(x => x.v));
        if (Math.abs(e) >= MICRO.threshold && past.filter(x => Math.abs(x.v) >= MICRO.threshold && x.v * e > 0).length >= 2) delta = e * MICRO.weight;
      }
      if (saturday && q[0] >= 1020 && q[0] < 1200) {
        const actual = microValues(satRefs, k, q[0], open, "actual");
        if (actual.length >= 2) {
          const gap = microMedian(actual.map(x => x.v)) - q[1];
          if (gap >= 10 && actual.filter(x => x.v - q[1] >= 10).length >= 2 && gap * MICRO.weight > delta) { delta = gap * MICRO.weight; past = actual; kind = "same-saturday"; }
        }
      }
      if (!delta) continue;
      if (!beforeMicro[k]) beforeMicro[k] = p.map(q => q.slice());
      for (let i = 1; i <= 3; i++) q[i] = Math.max(0, q[i] + delta);
      (applied[k] = applied[k] || []).push({ t: q[0], delta, kind, days: past.map(x => x.d) });
    }
  }
  return applied;
}
// 7年分の値（1時間平均を H:30 に置いて直線で）。なければ null
function p7At(p, k, t) { const r = p.v[k]; if (!r) return null; const x = (t - 30) / 60, h0 = Math.floor(x), f = x - h0, a = r[h0], b = r[h0 + 1]; return a != null && b != null ? a + (b - a) * f : a != null ? a : b != null ? b : null; }
// 乗り物ごとの時期の形（7年分）: 似た日の値を、行く日の時期の高さに直す（毎年10月後半に向けて人気3つが2〜4割上がるのに、今年の似た日は行く日より前の日しかないので低く出ていた）
//  各年・平日/休日ごとに、その乗り物の10〜20時の平均（log）が同じ年の前後60日の平均よりどれだけ高いか。行く日より前の年で前後7日を平均し、差の半分を掛ける
//  答え合わせ（前日夜、2025/10〜2026/10 の394日、予測検証/yoyride/ov_season5.js）: 全体 −0.11±0.07（前半 −0.10・後半 −0.12）、人気3つ −0.23±0.26。強さ1は −0.01±0.13（前半悪化）
const SEAS = { g: 0.5, win: 60, sm: 7 }, _rl = {}, _sd = {}, _sc = {};
function rideLev(d, k) { const key = d + "|" + k; if (key in _rl) return _rl[key]; const h = histHour(d, k); let r = null; if (h) { const v = []; for (let t = 10; t <= 20; t++) if (h[t] > 0) v.push(h[t]); if (v.length >= 6) r = Math.log(v.reduce((a, b) => a + b, 0) / v.length); } return (_rl[key] = r); }
function seasDev(k, typ, Y) {  // [[doy, 前後60日の平均からのずれ]]（Y 年より前）
  const key = k + "|" + typ + "|" + Y; if (key in _sd) return _sd[key];
  const by = {};
  for (const d of H7DAYS) { const y = +d.slice(0, 4); if (y >= Y || typOf(d) !== typ || ODD_DAYS.has(d)) continue; const l = rideLev(d, k); if (l != null) (by[y] = by[y] || []).push([doy(d), l]); }
  const out = [];
  for (const arr of Object.values(by)) for (const [a, l] of arr) { const w = arr.filter(([b]) => Math.abs(b - a) <= SEAS.win); if (w.length >= 20) out.push([a, l - w.reduce((s, q) => s + q[1], 0) / w.length]); }
  return (_sd[key] = out);
}
function seasAt(k, typ, Y, y0) {
  const key = k + "|" + typ + "|" + Y + "|" + y0; if (key in _sc) return _sc[key];
  const v = seasDev(k, typ, Y).filter(([a]) => { const z = Math.abs(a - y0); return Math.min(z, 365 - z) <= SEAS.sm; });
  return (_sc[key] = v.length >= 8 ? v.reduce((s, q) => s + q[1], 0) / v.length : null);
}
function seasF(k, date, x) {
  if (!HIST.keys.length) return 1;  // 7年分がないとき（検査など）は直さない
  const Y = +date.slice(0, 4), a = seasAt(k, typOf(date), Y, doy(date)), b = seasAt(k, typOf(x.d), Y, doy(x.d));
  return a == null || b == null ? 1 : Math.exp(SEAS.g * (a - b));
}
function buildModel(date) {
  const c = crowd(date), refs = c.refs, typ = typOf(date), [open, close] = hoursOf(date), sh = open - 480;
  const prof = {}, cut = {}, wide = {}, keys = Object.keys(RIDES).filter(k => avail(k, date));
  const al = m => (m < 720 ? m + sh : m), s0 = refs.filter(x => x.d < date && x.d >= addDays(date, -21)).length >= 3 && !isBig(date) ? 0.10 : 0.25;
  for (const k of keys) {
    const r = RIDES[k];
    if (r.src === "r") {
      const src = r.from_ || k;
      let rr = refs.filter(x => x.s[src]);
      if (r.from_) rr = DAYS.filter(x => fromDay(x.d) && typOf(x.d) === typ && x.s[src] && usable(x));
      else if (rr.length < 4) {  // 去年の同じ時期に休止していた等で記録が少ないときは、記録のある近い時期の日を使う
        const y = doy(date), dist = x => Math.min(Math.abs(doy(x.d) - y), 365 - Math.abs(doy(x.d) - y));
        rr = DAYS.filter(x => x.s[src] && typOf(x.d) === typ && usable(x)).sort((a, b) => dist(a) - dist(b)).slice(0, 10);
        wide[k] = rr.length ? Math.round(dist(rr[rr.length - 1])) : null;
      }
      const cutM = (r.cut_in || []).filter(([rg]) => inR(date, [rg])).map(x => x[1])[0], SF = r.from_ ? 1 : yoyRide(src), fx = rr.map(x => (c.cf || 1) * relF(date, x) * (lastYr(date, x) ? SF : 1) * wxF(date, x, src) * seasF(src, date, x) * preExF(date, src) * rainF(date));
      const mF = r.from_ ? 1 : morningF(src), lyF = rr.map(x => lastYr(date, x));
      // 似た日のうち、時期（年内の日付）が近い日ほど重く数える（exp(−日数差/21)）。答え合わせ（予測検証/similar/、2025/10〜2026/10）: 前日夜 ずれ 調整期間 −0.29±0.15・確認期間 −0.15±0.13分、約1か月前 −0.03・−0.17分。
      //  同時に試して効かなかった・悪くなった: 混み具合で直す・雨の日を外す・似た日の数を増減・混み具合の近い日だけ・直近14日のずれの持ち越し。去年の日を軽くする案は向きが割れたので見送り
      const wts = rr.map(x => (r.from_ ? 1 : Math.exp(-Math.min(Math.abs(doy(x.d) - doy(date)), 365 - Math.abs(doy(x.d) - doy(date))) / 21)));
      const pts = [], lasts = [];
      for (let i = 0; i < SLOT_M.length; i++) {
        const m = SLOT_M[i];
        if (m < (r.open ? r.open - 30 : 0) || (cutM && m > cutM)) continue;
        const mw = Math.max(0, Math.min(1, (MORN_MIN - (al(m) - open)) / MORN_MIN));  // 朝だけ（開園から90分でだんだん0に）
        const vw = []; rr.forEach((x, j) => { const w = dec(x.s[src], i); if (w != null) vw.push([w * fx[j] * (mw > 0 && lyF[j] ? Math.pow(mF, mw) : 1), wts[j]]); });
        if (vw.length >= 3) { const [med, lo, hi] = bandW(vw, s0); pts.push([al(m), Math.round(med), Math.round(lo), Math.round(hi), vw.length]); }
      }
      for (const x of rr) {
        const s = x.s[src]; if (!s) continue;
        let n = 0, last = null;
        for (let i = 0; i < s.length; i++) if (s[i] !== "." && (!r.open || SLOT_M[i] >= r.open - 30)) { n++; last = SLOT_M[i]; }
        if (n >= 6 && last != null) lasts.push(cutM ? Math.min(closeShift(x, last, close), cutM) : closeShift(x, last, close));
      }
      lasts.sort((a, b) => a - b);
      const p7 = !r.from_ && p7Of(date);  // 行く日が先なら7年分を混ぜる（log で。幅も同じ倍率でずらす）
      if (p7) for (const q of pts) { const v7 = p7At(p7, k, q[0]); if (v7 == null) continue; const nm = Math.exp((1 - p7.w) * Math.log(q[1] + 10) + p7.w * Math.log(v7 + 10)) - 10, f = (nm + 10) / (q[1] + 10); q[1] = Math.round(nm); q[2] = Math.max(0, Math.round((q[2] + 10) * f - 10)); q[3] = Math.round((q[3] + 10) * f - 10); }
      { const [ku, kl] = bandK(leadOf(date)); if (ku !== 1 || kl !== 1) for (const q of pts) { const lm = Math.log(q[1] + 10); q[3] = Math.max(q[1], Math.round(Math.exp(lm + ku * (Math.log(q[3] + 10) - lm)) - 10)); q[2] = Math.min(q[1], Math.max(0, Math.round(Math.exp(lm - kl * (lm - Math.log(q[2] + 10))) - 10))); } }  // 幅の倍率
      if (pts.length) { prof[k] = mergePts(pts); cut[k] = { p10: Math.min(lasts.length ? pct(lasts, 0.1) : close - 30, close - 15), med: lasts.length ? pct(lasts, 0.5) : close - 30, min: lasts[0], max: lasts[lasts.length - 1], n: lasts.length, days: rr.length }; }
    } else if (r.src === "h") {
      const hr = DAYS.filter(x => x.h[k] && typOf(x.d) === typ && usable(x));
      const hr2 = hr.length >= 4 ? hr : DAYS.filter(x => x.h[k] && usable(x));
      // 各日の値を、その日の全体の混み具合（x.avg）で割って行く日の予測の混み具合（c.avg）を掛ける。雨で空いた日がそのまま混ざって予測が低く出ていた（2026/10/28 貞子 17時 予測55・実際90）。
      //  答え合わせ（予測検証/horror/、2026/9〜10 のホラー1118か所）: 前日夜 ずれ10.2→8.9分、約1か月前 11.3→10.3分。似た日を絞る（refDays・日付の近さ）は効かなかった。幅は0.15で入る割合が93%→86%
      const nf = x => (c.avg && x.avg ? c.avg / x.avg : 1), pts = [];
      for (let i = 0; i < 14; i++) {
        const v = hr2.map(x => { const w = dec(x.h[k], i); return w == null ? null : w * nf(x); }).filter(x => x != null).sort((a, b) => a - b);
        if (v.length >= 3) { const [med, lo, hi] = bandOf(v, 0.15); pts.push([(8 + i) * 60 + 30, Math.round(med), Math.round(lo), Math.round(hi), v.length]); }
      }
      const lasts = hr2.map(x => { let L = null; for (let i = 0; i < 14; i++) if (dec(x.h[k], i) != null) L = (8 + i) * 60 + 30; return L == null ? null : closeShift(x, L, close); }).filter(v => v != null).sort((a, b) => a - b);
      if (pts.length) { prof[k] = pts; cut[k] = { p10: Math.min(close - 30, lasts.length ? pct(lasts, 0.1) : 1290), med: Math.min(close - 30, lasts.length ? pct(lasts, 0.5) : 1290), hourly: true, n: hr2.length, days: hr2.length }; }
    } else if (r.src === "est") {
      const [lo, me, hi] = typ === "平日" ? [10, 20, 30] : [20, 30, 40];
      prof[k] = []; for (let m = open + 30; m <= close - 30; m += 60) prof[k].push([m, me, lo, hi, 0]);
      cut[k] = { p10: close - 60, est: true };
    }
  }
  const dmF = dayMLF(date, prof, open, close);
  if (dmF !== 1) for (const k of keys) if (RIDES[k].src === "r" && prof[k]) prof[k] = prof[k].map(p => [p[0], p[1] * dmF, p[2] * dmF, p[3] * dmF, ...p.slice(4)]);
  shapeF(date, prof, open, close, keys);
  const beforeMicro = {}, micro = microApply(date, prof, open, beforeMicro);
  return { date, typ, open, close, crowd: c, prof, cut, keys, wide, dmF, micro, beforeMicro };
}
function baseAt(k, t, beforeMicro = false) {  // 今日の様子で直す前の予測（似た日から）
  const r = RIDES[k], p = (beforeMicro && M.beforeMicro && M.beforeMicro[k]) || M.prof[k];
  if (!p || !p.length || r.src === "ticket" || r.src === "show") return { med: 0, p10: 0, p90: 0 };
  if (t <= p[0][0]) {
    const op = Math.max(M.open, r.open || 0);
    // 開園から最初の記録の時刻までは、0から立ち上げず、最初の記録の値のまま（実際の記録では開園15分後にもう15〜30分ある。開園前から並ぶ人がいる）。
    //  前は直線で0から立ち上げていて、開園直後の「楽観」の予定で バックドロップ5分・ジュラパ3分 のように短すぎた
    return { med: p[0][1], p10: p[0][2], p90: p[0][3] };
  }
  const L = p[p.length - 1];
  if (t >= L[0]) return { med: L[1], p10: L[2], p90: L[3] };
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    if (a[0] <= t && t <= b[0]) { const g = (t - a[0]) / (b[0] - a[0]); return { med: a[1] + (b[1] - a[1]) * g, p10: a[2] + (b[2] - a[2]) * g, p90: a[3] + (b[3] - a[3]) * g }; }
  }
}
// ===== 当日の補正（ナウキャスト。予測検証/sonnet2/報告.md） =====
//  公式アプリで分かった今の待ち P().over[k] = {v, from}（スクショか手入力。乗り物ごとに最新だけ）から、あとの時刻の予測を直す
//    e = ln((v+10)/(予測+10))     … その乗り物の「実際÷予測」（待ちが小さいときも暴れないよう +10）
//    G = Σe / (n+1.5)             … 今日の混み具合（分かった乗り物の平均。1.5個ぶん0に寄せる）。今日の水準は夕方まで7〜10割残るので、全部の乗り物に掛ける
//    分かった乗り物 = ψ·[G + (e − G)·(0.3 + 0.7·exp(−経過分/100))]   分かっていない乗り物 = ψ·G
//    ψ = 1 − exp(−(分かった時刻 − 開園)/60)   … 開園直後の値は当てにならないので効きを弱める
//  幅は、ずらした中心から log(待ち+10) で ±hw: 分かった乗り物 0.15 + 0.20·(1−exp(−経過分/90))、分かっていない乗り物 0.40（開園直後の値なら広げる）
//  1日抜きの検証（根拠）中は直さない
const NC = { c: 10, kg: 1.5, om: 0.3, tau: 100, ts: 60, h0: 0.15, h1: 0.2, th: 90, hu: 0.4, hl: 0.5 };
let _nc = null;
function ncOf() {  // P().over か M が変わったときだけ作り直す（over は setOver で毎回新しい object にする）
  const o = P().over;
  if (_nc && _nc.o === o && _nc.M === M) return _nc;
  const ks = Object.keys(o).filter(k => o[k] && Number.isFinite(o[k].v) && o[k].v >= 0 && o[k].v <= 600 && Number.isFinite(o[k].from) && o[k].from >= 0 && o[k].from < 1440 && M.prof[k]), e = {}, psi = {};
  let sum = 0, t1 = -1;
  for (const k of ks) { const x = o[k], m = baseAt(k, x.from, true).med; e[k] = Math.log((x.v + NC.c) / (m + NC.c)); sum += e[k]; psi[k] = 1 - Math.exp(-Math.max(0, x.from - M.open) / NC.ts); t1 = Math.max(t1, x.from); }
  const G = ks.length ? sum / (ks.length + NC.kg) : 0;
  return (_nc = { o, M, ks, e, psi, G, t1, psiAll: t1 < 0 ? 0 : 1 - Math.exp(-Math.max(0, t1 - M.open) / NC.ts) });
}
function setOver(k, v, from, src) {  // 今の待ちを入れる（v が null なら消す）。同じ乗り物は新しい値で置き換える。src: 'auto'（ThemeParks.wiki）か 'manual'（手入力・スクショ）
  if (!RIDES[k] || (v != null && (!Number.isFinite(v) || v < 0 || v > 600 || !Number.isFinite(from) || from < 0 || from >= 1440))) return false;
  const o = Object.assign({}, P().over); delete o[k];
  if (v != null) o[k] = { v, from, src: src || "manual" };
  P().over = o;
  return true;
}
// ===== 当日の自動読み込み（ThemeParks.wiki の /live。Powered by ThemeParks.wiki） =====
//  lastUpdated は「値が変わった時刻」で、変わらなければ古いまま（10/21 に1分あけて2回取って確かめた。フラダイ60分は74分間そのまま）。
//  なので古さは1行ずつでなく、応答の中で一番新しい今日の lastUpdated（＝向こうが最後に取りに行った時刻）で見る。それが30分より古い応答は全部捨てる
//  値はその時刻（from）に分かったものとして入れる。手入力・スクショがその行の lastUpdated より新しければ上書きしない（向こうが変化を拾えていない）。予定の順番は変えない
//  OPERATING と待ち → over（src 'auto'）・休止を外す（lastUpdated が今日の行だけ。前日から変わっていない行は今の値とみなさない）。DOWN → 休止。CLOSED・REFURBISHMENT は開園30分後（夜だけのホラーはその開始30分後）〜閉園1時間前だけ休止（開始前・閉園後の CLOSED は無視）
//  ショーは、手で時刻を選んでいないときに使う今日の時刻（P().showLive。今より後の最初の回）。載っていないショーは「開催なし」とは扱わない
const tpwMin = s => { const t = Date.parse(s); if (!Number.isFinite(t)) return null; const j = new Date(t + 9 * 3600e3); return { d: j.toISOString().slice(0, 10), m: j.getUTCHours() * 60 + j.getUTCMinutes() }; };
function applyLive(json, nowMin) {
  const ids = D.tpw || {}, pl = P(), out = { at: null, lu: null, got: [], shut: [] };  // at＝使った値の時刻、lu＝応答の一番新しい今日の lastUpdated（古くて捨てたときも入る）
  const rows = (json && Array.isArray(json.liveData) ? json.liveData : []).map(x => ({ x, k: x && ids[x.id], t: x && tpwMin(x.lastUpdated) })).filter(r => r.k && RIDES[r.k] && r.t);
  const at = Math.max(-1, ...rows.filter(r => r.t.d === M.date).map(r => r.t.m)), from = Math.min(at, nowMin);
  if (at >= 0) out.lu = at;
  if (at < 0 || at < nowMin - 30) return out;  // 向こうの取得が止まっている・今日の応答でない
  out.at = from; pl.closed = pl.closed || {}; pl.liveTip = { ...(pl.liveTip || {}) }; pl.showLive = { ...(pl.showLive || {}) };
  for (const { x, k, t } of rows) {
    const R = RIDES[k], st = x.status, o = pl.over[k], w = x.queue && x.queue.STANDBY ? x.queue.STANDBY.waitTime : null, rm = t.d === M.date ? t.m : -1;
    if (R.src === "show") { const s1 = (x.showtimes || []).map(s => tpwMin(s && s.startTime)).filter(s => s && s.d === M.date && s.m > nowMin).map(s => s.m).sort((a, b) => a - b)[0]; if (s1 != null) pl.showLive[k] = s1; continue; }
    if (!(R.src === "r" || R.src === "h") || (o && o.src !== "auto" && o.from > rm)) continue;
    if (st === "OPERATING" && Number.isFinite(w)) {
      if (rm < 0 || (pl.closed[k] > rm && pl.closed[k] > from - 90) || !setOver(k, w, from, "auto")) continue;  // スクショで休止にしたあと、向こうはまだ変わっていない
      if (pl.closed[k] != null) { if (pl.closed[k] > from - 90) pl.liveTip[k] = { t: from, v: w }; delete pl.closed[k]; }
      else if (o && o.src === "auto" && o.v - w >= 20) pl.liveTip[k] = { t: from, v: w, a: o.v };
      out.got.push(k);
    } else if (st === "DOWN" || ((st === "CLOSED" || st === "REFURBISHMENT") && nowMin >= Math.max(M.open, R.open || 0) + 30 && nowMin <= M.close - 60)) { pl.closed[k] = Math.max(pl.closed[k] ?? -1, from); setOver(k, null); delete pl.liveTip[k]; out.shut.push(k); }
  }
  if (out.got.length >= 5) addObs(from, Object.fromEntries(out.got.filter(k => RIDES[k].src === "r").map(k => [k, pl.over[k].v])));
  return out;
}
// ===== 当日の似た日（予測検証/similar/sameday.py・sameday2.py） =====
//  読み込みのたびに全乗り物の待ちを P().obs = [{ t, w: { 乗り物: 待ち } }] に残す（同じ時刻±5分は置き換え、12回分まで）。
//  直近2時間に25分以上離れた2回分がそろったら、その動き（形）が一番近い過去の日を15日選び、その日の「あと」を借りる:
//   候補 x の差 D = ln(今日+10) − ln(x+10)、高さ lev = D の平均、遠さ = |D − lev| の平均。予測 = 中央値[ ln(x のあと+10) + lev + 0.5×(最新の時刻での乗り物ごとの残り差) ]
//  今の当日の補正と log で半々に混ぜる。答え合わせ（2026/5〜10、前日夜の予測から）: 今の当日の補正より 10〜16時のどの時刻でも −0.5〜−0.6分（±0.1〜0.2）。1時点だけだとぶれるので使わない
const AN = { K: 15, win: 120, span: 25, rw: 0.5, wb: 0.5, minN: 10 };
function addObs(t, w) {  // 自動読み込みは5分ごとなので、15分以内の前の記録は置き換え、4時間分（16回）まで持つ
  if (Object.keys(w).length < 5) return;
  const o = (P().obs || []).filter(s => s.t < t - 14 || s.t > t);
  P().obs = [...o, { t, w }].sort((a, b) => a.t - b.t).slice(-16);
}
// ===== 似た推移（予測検証/similar/knn.py・knn2.py） =====
//  その乗り物の直近1時間（60分前・30分前・今）の ln(待ち+10) の形（今の値を引いたもの）が一番近い過去の場面30個（前の日、同じ乗り物、時刻 ±60分）の、そのあとの上がり下がりを今の値に足す（中央値）。
//  今の予測（当日の補正と似た日の半々）に、何分後かで混ぜる: 30分後 0.75・60分後 0.5・90〜120分後 0.25・150分後から0（その間は直線）。
//  答え合わせ（2026/5〜10、180日、記録の時刻＝毎時15分で読む。similar/leak_sum.py）: 30分後 −0.45±0.09・60分後 −0.18±0.10・90〜120分後 −0.13±0.05分。上がり続ける勢いを伸ばす案は悪化した（trend.py）
//  （前に書いていた30分後 −1.04 は、正時の「今」を15分後の記録との間で作っていた評価で、先を見ていたぶん良く出ていた）。割合を 0.6〜1.0 に変えても ±0.04 分以内
const TJ = { K: 30, w: [[30, 0.75], [60, 0.5], [90, 0.25], [120, 0.25], [150, 0]] };
const trajW = dt => { const W = TJ.w; if (dt <= W[0][0]) return W[0][1]; for (let i = 1; i < W.length; i++) if (dt <= W[i][0]) { const [a, p] = W[i - 1], [b, q] = W[i]; return p + (q - p) * (dt - a) / (b - a); } return 0; };
function obsAt(k, T) {  // 読み込みの記録から、時刻 T のその乗り物の待ち（前後の記録の間を直線。近くに記録がなければ null）
  const pts = (P().obs || []).filter(s => s.w[k] != null).map(s => [s.t, s.w[k]]);
  const near = pts.reduce((m, p) => Math.min(m, Math.abs(p[0] - T)), Infinity); if (near > 20) return null;
  for (let i = 0; i < pts.length - 1; i++) if (pts[i][0] <= T && T <= pts[i + 1][0]) return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * (T - pts[i][0]) / Math.max(1, pts[i + 1][0] - pts[i][0]);
  return pts.length && Math.abs(pts[pts.length - 1][0] - T) <= 20 ? pts[pts.length - 1][1] : pts.length && Math.abs(pts[0][0] - T) <= 20 ? pts[0][1] : null;
}
let _tj = null;
function trajOf(k) {  // その乗り物の似た場面30個 [{ x, tau }]（読み込みの記録か M が変わったら作り直す）
  const obs = P().obs || [];
  if (!_tj || _tj.obs !== obs || _tj.M !== M) _tj = { obs, M, by: {} };
  if (k in _tj.by) return _tj.by[k];
  const done = r => (_tj.by[k] = r);
  if (!obs.length || excludeDay || RIDES[k].src !== "r") return done(null);
  const t1 = obs[obs.length - 1].t, q = [t1 - 60, t1 - 30, t1].map(T => obsAt(k, T));
  if (q.some(v => v == null)) return done(null);
  const lq = q.map(v => Math.log(v + NC.c)), sq = lq.map(v => v - lq[2]), cs = [];
  for (const x of DAYS) {
    if (x.d >= M.date || !usable(x) || !x.s[RIDES[k].from_ || k]) continue;
    for (let j = -2; j <= 2; j++) {
      const tau = t1 + 30 * j, w = [tau - 60, tau - 30, tau].map(T => dayWait0(k, x, T));
      if (w.some(v => !v || v.closed || v.w == null)) continue;
      const lw = w.map(v => Math.log(v.w + NC.c)), dist = Math.hypot(lw[0] - lw[2] - sq[0], lw[1] - lw[2] - sq[1]);
      cs.push({ x, tau, l0: lw[2], dist });
    }
  }
  if (cs.length < TJ.K) return done(null);
  return done({ t1, lq: lq[2], top: cs.sort((a, b) => a.dist - b.dist).slice(0, TJ.K), memo: new Map() });
}
// ===== 当日の機械学習（D.mlnow。予測検証/mlnow/train.py の LightGBM を木の和で） =====
//  似た推移が使えるとき（60分前・30分前・今の読み込みがある）に、アプリの答えの残りのずれ ln(実際+10)−ln(答え+10) を当てて足す（4時間後まで）。
//  手がかりは学習と同じ順: 乗り物・読み込んだ時刻・何分後・休日・前日夜の予測・今の答え−前日夜・似た日−前日夜・似た推移−前日夜・似た推移の割合・今／30分前／60分前のずれ・その変化2つ・全体のずれ・その変化・今の待ち（ln）
//  答え合わせ（6月までで学び7・8月で確認／8月までで学び9・10月で確認）: 30分後 −0.11／+0.04・60分後 −0.29／−0.06・90〜120分後 −0.26／−0.15・150〜240分後 −0.20／−0.13分。
//  アプリの中でも 7・8月 60分後 −0.28・90〜120分後 −0.32。45分後〜4時間後に使う。モデルは全部の日で学び直したもの
const MLN = (typeof D !== "undefined" && D.mlnow) || null;
const AREA_OF = {}; if (typeof D !== "undefined") for (const a of D.areas || []) for (const k of a.rides || []) AREA_OF[k] = a.key;
function mlTree(n, f) {  // 葉は数値。節は [特徴, しきい値 or 乗り物の集合, 欠損の扱い（1左・0右・2は0とみなす）, 左, 右]
  while (Array.isArray(n)) { const v = f[n[0]], thr = n[1]; let left; if (Array.isArray(thr)) left = thr.includes(v); else if (v == null || Number.isNaN(v)) left = n[2] === 2 ? 0 <= thr : n[2] === 1; else left = v <= thr; n = left ? n[3] : n[4]; }
  return n;
}
const mlPredict = f => MLN.trees.reduce((s, t) => s + mlTree(t, f), 0);
function mlDelta(k, t, lb, lm, la, tj) {
  if (!MLN) return 0;
  const a = trajOf(k); if (!a) return 0;  // 60分前・30分前・今の読み込みがあるとき（学習と同じ条件）
  const t0 = a.t1, h = t - t0; if (h < 45 || h > 240) return 0;  // 30分後は期間で良くも悪くもなる（6月までで学んで7〜10月 −0.06、8月までで学んで9・10月 +0.15）ので使わない
  const L = v => Math.log(v + NC.c), ob = T => obsAt(k, T), bl = T => L(baseAt(k, T, true).med), v0 = ob(t0), v1 = ob(t0 - 30), v2 = ob(t0 - 60);
  if (v0 == null) return 0;
  const e0 = L(v0) - bl(t0), e1 = v1 == null ? NaN : L(v1) - bl(t0 - 30), e2 = v2 == null ? NaN : L(v2) - bl(t0 - 60);
  const s = ncOf(), g2 = M.keys.filter(q => RIDES[q].src === "r" && !RIDES[q].from_).map(q => { const v = obsAt(q, t0 - 60); return v == null || !M.prof[q] ? null : L(v) - L(baseAt(q, t0 - 60, true).med); }).filter(v => v != null);
  const G2 = g2.length ? g2.reduce((p, q) => p + q, 0) / g2.length : 0;
  const f = [k, t0, h, isOff(M.date) ? 1 : 0, lb, lm - lb, la == null ? NaN : la - lb, tj ? tj.lm - lb : NaN, tj ? tj.w : 0, e0, e1, e2, e0 - e1, e1 - e2, s.G, s.G - G2, L(v0)];
  if (MLN.features.length > f.length) {  // 近くの乗り物（同じエリア）の今のずれ・その30分の変化、ホラーナイト、除外日、長い除外日の直前（mlnow/ml_rows.cjs と同じ作り方）
    const ar = AREA_OF[k], nb = T => { const v = M.keys.filter(q => q !== k && ar && AREA_OF[q] === ar && RIDES[q].src === "r" && M.prof[q] && !RIDES[q].from_).map(q => { const w = obsAt(q, T); return w == null ? null : L(w) - L(baseAt(q, T, true).med); }).filter(v => v != null); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : NaN; };
    const n0 = nb(t0), n1 = nb(t0 - 30);
    f.push(n0, Number.isNaN(n0) || Number.isNaN(n1) ? NaN : n0 - n1, inR(M.date, HHN_ALL) ? 1 : 0, isPassEx(M.date) ? 1 : 0, preExF(M.date, "ハリーポッター") > 1 ? 1 : 0);
  }
  return mlPredict(f);
}
// 似た推移から見た、時刻 t の ln(待ち+10)（使えなければ null）と混ぜる割合
function trajLm(k, t) {
  const a = trajOf(k); if (!a || t <= a.t1) return null;
  const dt = t - a.t1, w = trajW(dt); if (!w) return null;
  const key = Math.round(dt / 5); if (!a.memo.has(key)) {
    const v = a.top.map(c => { const r = dayWait0(k, c.x, c.tau + dt); return r && !r.closed && r.w != null ? Math.log(r.w + NC.c) - c.l0 : null; }).filter(q => q != null).sort((p, q) => p - q);
    a.memo.set(key, v.length >= 10 ? a.lq + v[v.length >> 1] : null);
  }
  const lm = a.memo.get(key); return lm == null ? null : { lm, w };
}
let _an = null;
function analogOf() {
  const obs = P().obs || [];
  if (_an && _an.obs === obs && _an.M === M) return _an.r;
  const done = r => ((_an = { obs, M, r }), r);
  if (!obs.length || excludeDay) return done(null);
  const t1 = obs[obs.length - 1].t, use = obs.filter(s => s.t >= t1 - AN.win);
  if (use.length < 2 || t1 - use[0].t < AN.span) return done(null);
  const last = use[use.length - 1], cands = [];
  for (const x of DAYS) {
    if (x.d >= M.date || !usable(x) || !Object.keys(x.s).length) continue;
    const Ds = [];
    for (const s of use) for (const [k, v] of Object.entries(s.w)) { const w = dayWait0(k, x, s.t); if (w && !w.closed && w.w != null) Ds.push(Math.log(v + NC.c) - Math.log(w.w + NC.c)); }
    if (Ds.length < AN.minN) continue;
    const lev = Ds.reduce((a, b) => a + b, 0) / Ds.length, dist = Ds.reduce((a, b) => a + Math.abs(b - lev), 0) / Ds.length;
    cands.push({ x, lev, dist });
  }
  if (cands.length < AN.K) return done(null);
  const top = cands.sort((a, b) => a.dist - b.dist).slice(0, AN.K);
  for (const c of top) { c.rk = {}; for (const [k, v] of Object.entries(last.w)) { const w = dayWait0(k, c.x, last.t); if (w && !w.closed && w.w != null) c.rk[k] = Math.log(v + NC.c) - (Math.log(w.w + NC.c) + c.lev); } }
  return done({ t1, top, memo: new Map() });
}
// 似た日から借りた、その時刻の ln(待ち+10)（借りられる日が5日未満なら null）
function analogLm(k, t) {
  const a = analogOf(); if (!a || t <= a.t1 || RIDES[k].src !== "r") return null;
  const key = k + "|" + Math.round(t / 5); if (a.memo.has(key)) return a.memo.get(key);
  const v = a.top.map(c => { const w = dayWait0(k, c.x, t); return w && !w.closed && w.w != null ? Math.log(w.w + NC.c) + c.lev + AN.rw * (c.rk[k] || 0) : null; }).filter(q => q != null).sort((p, q) => p - q);
  const r = v.length >= 5 ? v[v.length >> 1] : null; a.memo.set(key, r); return r;
}
// 自動読み込みの記録（P().autoAt）。t＝最後に通信できた時刻（時計）、lu＝その応答の一番新しい今日の lastUpdated（値が変わった時刻）、old＝古くて使わなかった、at・n＝最後に使った値の時刻と個数、fail・err＝続けて失敗した回数と最後の失敗。待ち（over）や補正には触らない
function noteLive(now, out, err) {
  const a = { ...(P().autoAt || {}) };
  if (err) { a.fail = (a.fail || 0) + 1; a.err = String(err); }
  else { a.t = now; a.lu = out.lu; a.old = out.at == null; a.fail = 0; delete a.err; if (out.at != null) { a.at = out.at; a.n = out.got.length; } }
  return (P().autoAt = a);
}
const analogDays = () => { const a = analogOf(); return a ? a.top.slice(0, 3).map(c => c.x.d) : null; };  // 当日の似た日（近い順に3日。表示用）
const todayLevel = () => { const s = ncOf(); return s.ks.length ? { pct: Math.round((Math.exp(s.psiAll * s.G) - 1) * 100), n: s.ks.length, at: s.t1 } : null; };  // 今日は予測より何%混んでいるか
function waitAt(k, t) {
  const prior = baseAt(k, t);
  if (!prior || excludeDay) return prior;
  const s = ncOf();
  if (!s.ks.length) return prior;
  // 当日モデルは局所補正前の予測を基準に学習済み。観測後はその基準で計算し、二重に直さない。
  const b = baseAt(k, t, true);
  if (!(b.med || b.p90)) return b;
  const x = P().over[k], seen = x && x.v != null && s.e[k] != null;
  if (t < (seen ? x.from : s.t1) - 30) return b;  // 分かった時刻より前は直さない
  const h = seen ? Math.max(0, t - x.from) : 0;
  const sh = seen ? s.psi[k] * (s.G + (s.e[k] - s.G) * (NC.om + (1 - NC.om) * Math.exp(-h / NC.tau))) : s.psiAll * s.G;
  const lm0 = Math.log(b.med + NC.c) + sh, la = analogLm(k, t), lm1 = la == null ? lm0 : (1 - AN.wb) * lm0 + AN.wb * la;  // 当日の似た日と半々
  const tj = trajLm(k, t), lm2 = tj ? (1 - tj.w) * lm1 + tj.w * tj.lm : lm1;  // 似た推移を何分後かに応じて混ぜる
  const lm = lm2 + mlDelta(k, t, Math.log(b.med + NC.c), lm2, la, tj);  // 当日の機械学習で残りのずれを直す
  const hw = (seen ? NC.h0 + NC.h1 * (1 - Math.exp(-h / NC.th)) : NC.hu) * (1 + NC.hl * Math.exp(-Math.max(0, (seen ? x.from : s.t1) - M.open) / NC.ts));
  return { med: Math.max(0, Math.exp(lm) - NC.c), p10: Math.max(0, Math.exp(lm - hw) - NC.c), p90: Math.max(0, Math.exp(lm + hw) - NC.c) };
}
// 組み方（S.style）: lean＝ふつう（待ちは似た日のふつうの値。はじめの値）／normal＝慎重（ふつうと多めの中間）／must＝必ず最優先。sure＝確実は画面から外した（シー版と同じ考え方）
// 計画で見る「多め」: 予測の幅（p90）は正直な80%の範囲に広げたので、計画の控えめさは前と同じになるよう 0.32 を掛ける（前の上乗せ 平均12分 ÷ 今の 37分）
const PK = 0.32, upper = w => w.med + PK * Math.max(0, w.p90 - w.med);
// エクスプレス・パス（P().ep = { 乗り物: { at: 時間指定の時刻 or null } }。日付ごと）。専用の列なので待ちは10分ほどで見る
const EPW = 10, epOf = k => (P().ep || {})[k] || null;
// もう1回（2つ目、again）: エクスプレス・パスは1回分なので2つ目はふつうに並ぶ。「必ず」も1つ目だけ
const mustIt = it => S.must.includes(it.key) && !it.again;
// 同じ乗り物の2つ目に印を付ける。どの足し方（空き時間・当日のパレット・写真のドラッグ・わんちゃん）でも通す
const markAgain = it => { if (RIDES[it.key] && (P().items || []).some(x => x.key === it.key && x.id !== it.id)) it.again = true; return it; };
const planWait = (k, t, ag = false) => { if (!ag && epOf(k)) return EPW; const w = waitAt(k, t); return w.med + (S.style === "sure" ? 1 : S.style === "lean" ? 0 : S.slack ? 0.5 : 0) * PK * Math.max(0, w.p90 - w.med); };
const openAt = k => { const r = RIDES[k]; if (r.src === "show") return showTime(k) - r.early; return Math.max(M.open, r.open || 0); };
// その日の人気（今日の様子で直す前の予測の、開いている時間の1時間ごとの平均の待ち）。空き時間に足す候補を人気順に並べるのに使う。モデルごとに覚える
const popMemo = new WeakMap();
function popOf(k) {
  let c = popMemo.get(M); if (!c) popMemo.set(M, (c = {}));
  if (c[k] == null) { let s = 0, n = 0; for (let t = openAt(k) + 30; t <= lastAt(k) - 30; t += 60) { s += baseAt(k, t).med; n++; } c[k] = n ? Math.round(s / n) : 0; }
  return c[k];
}
function lastAt(k) {
  const r = RIDES[k];
  if (r.src === "ticket") return M.close - 90;
  if (r.src === "show") return showTime(k) - r.early;
  const c = M.cut[k]; if (!c) return M.close - 30;
  return c.hourly ? c.p10 : c.p10;
}
const showTime = k => S.showAt[k] || (M.date === S.date && (P().showLive || {})[k]) || ((RIDES[k].dfs || []).find(([rg]) => inR(M.date, [rg])) || [0, RIDES[k].df])[1];  // dfs: 時期ごとのいつもの時刻
const durOf = k => { const r = RIDES[k]; return r.src === "show" ? r.early + r.len : r.dur; };

// ================= 希望の乗り物で、近い日を比べる（見るだけ。S.date・予定・M は変えない。日付を変えるのは「この日にする」を押したときだけ） =================
// 候補日は日の画面の「近くの空いている日」と同じ選び方（前後2週間・今日以降・混み具合の順）
const nearDays = (date, today = TODAY) => { const a = []; for (let i = -14; i <= 14; i++) { const d = addDays(date, i); if (d >= today) a.push([d, crowd(d)]); } return a.sort((x, y) => x[1].lv - y[1].lv || (x[1].avg || 999) - (y[1].avg || 999)); };
// 順位（いちばん短い・同程度）は付けない。答え合わせ（予測検証/eval_daycmp.cjs、2025/9〜2026/10の287日（前日の夜は319日）・人気の4つ・前後2週間の日どうし）で、合計の平均の差が15分を超えた組で実際も同じ向きだったのは、約1か月前の予測で60%・前日の夜の予測で65%しかない
function compareDays(dates, keys, entry = 0) {  // entry: 開園から何分後に入園するか（開園時刻が違う日も、開園からのずれで同じにそろえる）
  const m0 = M, ks = keys.filter(k => RIDES[k] && ["r", "h"].includes(RIDES[k].src));  // 待ちを比べるのは記録のある乗り物だけ（ショー・整理券・目安だけの乗り物は、乗れるかだけ見る）
  let cols;
  try {
    cols = dates.map(d => {
      M = buildModel(d); const w = {}, late = [], days = {};
      // 乗り物ごとに、入園してから受付終了の30分前までの予測（似た日から。今日の表示値での補正はしない）: [いちばん短い時刻, その待ち, 平均]。全部をいちばん短い時刻に乗れるわけではないので、合計は平均で出す
      for (const k of ks) if (avail(k, d)) { const p = (M.prof[k] || []).filter(q => q[0] >= Math.max(M.open + entry, openAt(k)) && q[0] <= lastAt(k) - 30), b = p.length && p.reduce((a, q) => (q[1] < a[1] ? q : a)); w[k] = p.length ? [b[0], b[1], Math.round(p.reduce((a, q) => a + q[1], 0) / p.length)] : null; if (!p.length && (M.prof[k] || []).length) late.push(k); if (M.cut[k] && M.cut[k].days != null) days[k] = M.cut[k].days; }
      return { d, open: M.open, close: M.close, official: !!D.hours[d], lv: M.crowd.lv, n: M.crowd.n, days, wide: ks.filter(k => M.wide[k] != null), late, few: fewPrecedent(d), no: keys.filter(k => RIDES[k] && !avail(k, d)), w };
    });
  } finally { M = m0; }
  const common = ks.filter(k => cols.every(x => x.w[k]));  // 合計は、どの日も予測がある乗り物だけ
  cols.forEach(x => { x.total = common.length ? common.reduce((a, k) => a + x.w[k][2], 0) : null; x.miss = x.no.filter(k => cols.some(y => !y.no.includes(k))); });  // ほかの日なら乗れる希望が乗れない日（どの日も乗れない希望では分けない）
  return { cols, common, ks };
}

// ================= 地図と歩く時間 =================
const NODES = MAPD.nodes, NID = Object.keys(NODES), NI = Object.fromEntries(NID.map((k, i) => [k, i]));
const NN = NID.length, DM = Array.from({ length: NN }, () => new Float64Array(NN).fill(1e9)), NX = Array.from({ length: NN }, () => new Int16Array(NN).fill(-1));
for (let i = 0; i < NN; i++) { DM[i][i] = 0; NX[i][i] = i; }
for (const [a, b] of MAPD.edges) { const i = NI[a], j = NI[b], w = Math.hypot(NODES[a][0] - NODES[b][0], NODES[a][1] - NODES[b][1]); DM[i][j] = DM[j][i] = w; NX[i][j] = j; NX[j][i] = i; }
for (let k = 0; k < NN; k++) for (let i = 0; i < NN; i++) { const dik = DM[i][k]; if (dik >= 1e9) continue; for (let j = 0; j < NN; j++) if (dik + DM[k][j] < DM[i][j]) { DM[i][j] = dik + DM[k][j]; NX[i][j] = NX[i][k]; } }
// 場所の表し方: "pin:キー" / "store:キー" / "wc:番号" / "pt:x,y"
function ptOf(loc) {
  const [t, v] = loc.split(":");
  if (t === "pin") return MAPD.pins[v];
  if (t === "store") return FOOD.stores[v] ? [FOOD.stores[v].x, FOOD.stores[v].y] : MAPD.pins["ゲート"];  // 閉店した店（保存済みの場所）は入口に
  if (t === "wc") return [FOOD.toilets[+v].x, FOOD.toilets[+v].y];
  return v.split(",").map(Number);
}
const nearCache = {};
function nodeOf(loc) {
  if (nearCache[loc] != null) return nearCache[loc];
  const [t, v] = loc.split(":");
  if (t === "pin" && MAPD.attach[v]) return (nearCache[loc] = NI[MAPD.attach[v]]);
  const [x, y] = ptOf(loc); let best = 0, bd = 1e9;
  NID.forEach((k, i) => { const d = Math.hypot(NODES[k][0] - x, NODES[k][1] - y); if (d < bd) { bd = d; best = i; } });
  return (nearCache[loc] = best);
}
function walkPx(a, b) {
  if (a === b) return 0;
  const pa = ptOf(a), pb = ptOf(b), na = nodeOf(a), nb = nodeOf(b);
  const via = Math.hypot(pa[0] - NODES[NID[na]][0], pa[1] - NODES[NID[na]][1]) + DM[na][nb] + Math.hypot(pb[0] - NODES[NID[nb]][0], pb[1] - NODES[NID[nb]][1]);
  return via;  // 必ず通路に沿った道のり（直線で代用しない）
}
const walkMin = (a, b) => (a === b ? 0 : Math.round(walkPx(a, b) * MAPD.mpp / (70 * S.speed) + 1));
const walkPlan = (a, b) => { if (a === b) return 1; return walkMin(a, b); };  // 歩く時間はふつうに歩く速さのまま（前は1.2倍＋2分を足していた。シー版で「やりすぎ」）
function pathPts(a, b) {
  const pa = ptOf(a), pb = ptOf(b), na = nodeOf(a), nb = nodeOf(b), out = [pa];
  let i = na; out.push(NODES[NID[i]]); while (i !== nb && i >= 0) { i = NX[i][nb]; out.push(NODES[NID[i]]); }
  out.push(pb); return out;
}
const locOfRide = k => "pin:" + RIDES[k].pin;
const GATE = "pin:ゲート";

// ================= 店とトイレの行列（目安） =================
const CF = () => [0.75, 1, 1.3, 1.6][M ? M.crowd.lv : 1];
function peak(t, kind) {
  if (t >= 690 && t <= 810) return kind === "rest" ? 3.2 : 2.3;
  if (t >= 1050 && t <= 1170) return kind === "rest" ? 2.4 : 1.7;
  if (t >= 900 && t <= 960) return 1.3;
  return 1;
}
function storeQueue(sk, t) { const s = FOOD.stores[sk], base = { cart: 4, snack: 6, rest: 10 }[s.type]; return Math.round(base * s.pop * peak(t, s.type) * CF()); }
function wcQueue(i, t) { const w = FOOD.toilets[i], base = [1, 3, 7][w.crowd]; const f = t >= 690 && t <= 840 ? 1.6 : t >= 1080 && t <= 1200 ? 1.3 : 1; return Math.round(base * f * CF()); }
const STORE_USE = { cart: 4, snack: 6, rest: 0 }, WC_USE = 6;
// ニンテンドーの中の店・トイレは、エリアに入るのに整理券が要る時間があるので、選んだときだけ候補にする
const inNinArea = a => a.includes("ニンテンドー");
const wcOpen = i => S.inNin || !inNinArea(FOOD.toilets[i].area);
const storeOpen = sk => S.inNin || !inNinArea(FOOD.stores[sk].area);
// 行列は目安なので、幅と3段階で見せる
const qtxt = q => `${q <= 5 ? "空きやすい" : q <= 15 ? "ふつう" : "並びやすい"}・${Math.max(0, Math.round(q * 0.5))}〜${Math.round(q * 1.6)}分`;
function bestStore(itemKey, from, t, to = null) {
  let best = null;
  for (const sk of FOOD.items[itemKey].stores) {
    if (!storeOpen(sk) && FOOD.items[itemKey].stores.some(storeOpen)) continue;
    const l = "store:" + sk, w = walkMin(from, l), q = storeQueue(sk, t + w), back = to ? walkMin(l, to) : 0, tot = w + q + STORE_USE[FOOD.stores[sk].type] + back;
    if (!best || tot < best.tot) best = { loc: l, sk, walk: w, q, tot };
  }
  return best;
}
// トイレの選び方（推定の待ち時間は当てにならないので、近さを基本にする）
//  寄り道 = 今→トイレ + トイレ→次 − 今→次。寄り道が一番短い所が基本。歩いて1分以内にあれば必ずそこ。
//  ほかを勧めるのは「寄り道＋待ちの半分」が5分以上よく、混みやすさが2段階違う（混む→空いている）ときだけ
function bestWC(from, t, to = null) {
  const c = [];
  FOOD.toilets.forEach((w, i) => {
    if (!wcOpen(i)) return;
    const l = "wc:" + i, wk = walkMin(from, l), back = to ? walkMin(l, to) : 0, detour = wk + back - (to ? walkMin(from, to) : 0), q = wcQueue(i, t + wk);
    c.push({ loc: l, i, walk: wk, q, detour, score: detour + 0.5 * q, tot: wk + q + WC_USE + back });
  });
  if (!c.length) return null;
  c.sort((a, b) => a.detour - b.detour || a.walk - b.walk);
  const near = c[0];
  if (near.walk <= 1) return { ...near, near };
  const alt = c.filter(x => x.detour <= near.detour + 3 && x.score <= near.score - 5 && FOOD.toilets[near.i].crowd - FOOD.toilets[x.i].crowd >= 2).sort((a, b) => a.score - b.score)[0];
  return alt ? { ...alt, near, why: `一番近い${FOOD.toilets[near.i].name}（歩く${near.walk}分）は混みやすいので` } : { ...near, near };
}
const MEALSTORE = ["mels", "louies", "studio_stars", "parkside", "dragon", "discovery", "lostworld", "amity_landing", "snoopy_cafe", "three_broom", "saido", "happiness"]  // フィネガンズは 2025/11/3 に閉店;
function bestMeal(from, t) {
  let best = null;
  for (const sk of MEALSTORE) { const l = "store:" + sk, w = walkMin(from, l), q = storeQueue(sk, t + w), tot = w + q; if (!best || tot < best.tot) best = { loc: l, sk, walk: w, q, tot }; }
  return best;
}

// ================= ルートを探す（ビーム探索） =================
// タスク: ride / ticket / show（場所あり）と、meal / food / wc / rest（場所はあとで決める）
const CUT_SLACK = 0, CUT_MUST = 45, CUT_SURE = 60;
const VALUE = 240;  // 1個に乗る価値（待ち時間の分に換算）。混む時期でも、時間が余るなら乗る
let planErr = "";
function taskOf(it) {
  if (it.type === "ride" || it.type === "ticket" || it.type === "show") {
    const k = it.key, r = RIDES[k];
    let open = openAt(k), last = lastAt(k);
    if (it.pin != null) { open = it.pin; last = it.pin; }
    // 受付の締め切り（lastAt）は「似た日の9割はこの時刻まで並べた」見込みで、もう控えめ。「必ず」以外はそれまでに着けばよい。「必ず」は外れると困るので45分前まで（シー版と同じ）
    const lastP = S.slack && r.src !== "ticket" && r.src !== "show" && it.pin == null ? last - (S.style === "sure" ? CUT_SURE : S.must.includes(k) && !it.again ? CUT_MUST : CUT_SLACK) : last;
    return { it, k, loc: locOfRide(k), dur: durOf(k), open, last, lastP, val: r.w, buf: S.slack && r.src === "ticket" && it.pin == null ? 20 : 0, wait: r.src === "ticket" || r.src === "show" ? 0 : null, after: r.after };
  }
  const meal = it.type === "meal", lunch = it.key === "昼ごはん";
  const win = meal ? (lunch ? [Math.max(M.open, 660), 810] : [1020, Math.min(1170, M.close - 60)]) : [M.open, M.close - 20];
  // 店・移動・行列・所要時間は、候補をつなぐときに simulate と共通の計算で決める。
  return { it, k: it.key || it.type, loc: null, open: it.pin != null ? it.pin : win[0], last: it.pin != null ? it.pin : win[1], lastP: it.pin != null ? it.pin : win[1], val: 0, buf: 0, wait: 0, meal: true };
}
function planRoute(items, mustKeys, opt = {}) {
  const queued = items.filter(it => it.qs != null && RIDES[it.key]);
  if (queued.length) {
    if (queued.length > 1) { planErr = "並び中の乗り物が複数あります。並ぶのをやめたものを解除してください。"; return null; }
    const active = queued[0], head = simulate([active]).rows[0];
    const rest = planRoute(items.filter(it => it !== active), mustKeys.filter(k => k !== active.key),
      { ...opt, first: null, start: Math.max(opt.start ?? head.end, head.end), loc: head.to });
    return rest ? { ...rest, order: [{ ...active }, ...rest.order] } : null;
  }
  const T0 = opt.start ?? (M.open + (S.entry || 0) + (S.slack ? 15 : 0)), L0 = opt.loc || GATE;
  const tasks = items.map(it => taskOf(it.autoStore || it.autoWC ? { ...it, store: it.autoStore ? undefined : it.store, wcI: it.autoWC ? undefined : it.wcI } : it)), n = tasks.length;
  tasks.forEach(tk => {
    if (opt.start != null && tk.it.type === "meal" && tk.it.pin == null && T0 > tk.lastP) {
      tk.open = Math.max(T0, tk.open); tk.last = tk.lastP = M.close;
    }
  });
  const locs = [L0, ...new Set(tasks.filter(t => t.loc).map(t => t.loc))], LI = Object.fromEntries(locs.map((l, i) => [l, i]));
  const WK = locs.map(a => locs.map(b => walkPlan(a, b)));
  tasks.forEach(tk => { tk.li = tk.loc ? LI[tk.loc] : -1; const j = tk.after ? tasks.findIndex(x => x.k === tk.after) : -1; tk.req = j >= 0 ? 1 << j : 0; });
  const W = tasks.map(tk => { const a = new Float32Array(900); if (tk.wait === null) for (let t = 0; t < 900; t++) a[t] = planWait(tk.k, 480 + t, tk.it.again); return a; });
  // 見積もりの「重さ」: 待ち＋ぶれの分＋受付終了の60分前からは締め切り間際ほど重く（余裕があるのに閉まる直前を選ばない）
  const C = tasks.map((tk, i) => { const a = new Float32Array(900); for (let t = 0; t < 900; t++) { const w = W[i][t]; if (tk.wait === null) { const ww = epOf(tk.k) && !tk.it.again ? { med: 0, p90: 0 } : waitAt(tk.k, 480 + t); a[t] = w + 0.25 * PK * Math.max(0, ww.p90 - ww.med) + 0.5 * Math.max(0, 60 - (tk.last - 480 - t)); } else a[t] = 0; } return a; });
  const mustMask = tasks.reduce((m, t, i) => ((mustKeys.includes(t.k) && !t.it.again) || t.meal || t.it.pin != null ? m | 1 << i : m), 0);
  const mustIdx = tasks.map((_, i) => i).filter(i => mustMask >> i & 1);
  if (n > 30) { planErr = "選んだものが30個を超えています。いくつか外してください。"; return null; }
  planErr = "";
  // 並ぶ時間を減らせるなら自由時間を残す。空きの長さ自体には減点しない。
  const IDLES = [0, 15, 30, 45, 60, 90, 120, 180, 240], CAP = 4, BEAM = opt.beam || (n > 16 ? 1000 : 2000);
  // opt.last: この乗り物を最後にする（そのあとには何も入れない。「最後の枠を比べる」用）
  const LI_ = opt.last ? tasks.findIndex(t => t.k === opt.last && !t.meal) : -1;
  let init = { mask: 0, fin: T0, tot: 0, val: 0, li: 0, loc: L0, node: null };
  let fi = opt.first && opt.first !== opt.last ? tasks.findIndex(t => t.k === opt.first && t.it.pin == null) : -1;  // 最後にする乗り物は最初にしない
  if (fi < 0 && T0 <= M.open + 30) {
    const fixed = tasks.filter(t => t.it.pin != null);
    const open = tasks.filter(t => {
      if (!RIDES[t.k] || !M.prof[t.k] || t.it.pin != null || t.open > T0 + 30 || t.req || t.k === opt.last) return false;
      const at = Math.max(T0 + walkPlan(L0, t.loc), t.open), end = at + planWait(t.k, at, t.it.again) + t.dur;
      return at <= t.lastP && end <= M.close && fixed.every(f => end + (f.loc ? walkPlan(t.loc, f.loc) : 0) <= f.lastP);
    });
    const must = open.filter(t => mustKeys.includes(t.k)), pool = must.length ? must : open;
    const demand = t => medOf(M.prof[t.k].filter(p => p[0] >= M.open + 90 && p[0] <= t.lastP).map(p => p[1])) ?? 0;
    // 朝の枠は、希望の中で混みやすい上位2つから「今先に乗る利点」が大きいものへ。
    const early = pool.slice().sort((a, b) => demand(b) - demand(a)).slice(0, 2);
    early.sort((a, b) => (planWait(a.k, T0 + walkPlan(L0, a.loc), a.it.again) + walkPlan(L0, a.loc) - demand(a)) - (planWait(b.k, T0 + walkPlan(L0, b.loc), b.it.again) + walkPlan(L0, b.loc) - demand(b)));
    if (early.length) fi = tasks.indexOf(early[0]);
  }
  if (fi >= 0) {
    const tk = tasks[fi], st = Math.max(Math.round(T0 + WK[0][tk.li]), tk.open), wi = Math.max(0, Math.min(899, st - 480)), w = W[fi][wi];
    if (tk.req || st > tk.lastP || st + w + tk.dur > M.close) { planErr = "最初に乗る指定が、営業時間・受付終了・整理券の順番に合いません。最初の乗り物を選び直してください。"; return null; }
    init = { mask: 1 << fi, fin: st + w + tk.dur, tot: C[fi][wi] + WK[0][tk.li], val: tk.val, li: tk.li, loc: tk.loc, node: { i: fi, st, w, prev: null } };
  }
  let best = null;
  const orderOf = s => {
    const path = []; for (let nd = s.node; nd; nd = nd.prev) path.unshift(nd);
    return path.map(nd => {
      const it = { ...tasks[nd.i].it, at: nd.st, quietAt: nd.idle > 0 ? nd.st : undefined };
      if ((it.type === "ticket" || it.type === "show") && it.pin == null) it.pin = nd.st;
      if (nd.sk) { it.store = nd.sk; it.autoStore = !tasks[nd.i].it.store; }
      if (nd.wcI != null) { it.wcI = nd.wcI; it.autoWC = tasks[nd.i].it.wcI == null; }
      return it;
    });
  };
  const consider = s => {
    if ((s.mask & mustMask) !== mustMask) return;
    if (LI_ >= 0 && !(s.node && s.node.i === LI_)) return;
    const sc = VALUE * s.val - s.tot;
    if (best && sc <= best.sc) return;
    // ponytail: 食事先と実際の道のりまで含めて確かめ、概算でだけ間に合う候補は採用しない。
    const order = orderOf(s), sim = simulate(order, { start: T0, loc: L0 });
    if (!sim.bad) best = { sc, c: s, order };
  };
  let layer = [init]; consider(init);
  for (let step = 0; step < n; step++) {
    const nxt = new Map();
    for (const s0 of layer) for (let i = 0; i < n; i++) {
      if (LI_ >= 0 && s0.mask >> LI_ & 1) break;  // 最後にする乗り物のあとには入れない
      if (s0.mask >> i & 1) continue;
      const tk = tasks[i];
      if (tk.req && !(s0.mask & tk.req)) continue;
      // 食事・フード・トイレも、表示時と同じ計算で店・移動・行列を確定する。
      // 概算の「歩く10分＋食事」で時刻だけ先へ進めると、表示時に差が空き時間になってしまう。
      const visit = tk.meal ? simulate([{ ...tk.it, at: tk.open }], { start: s0.fin, loc: s0.loc }).rows[0] : null;
      const dest = visit ? visit.to : tk.loc || s0.loc;
      const wk = visit ? visit.walk : tk.li < 0 ? 0 : s0.li >= 0 ? WK[s0.li][tk.li] : walkPlan(s0.loc, tk.loc);
      const soon = Math.max(Math.round(s0.fin + wk + tk.buf), tk.open), soonW = W[i][Math.max(0, Math.min(899, soon - 480))];
      for (const idle of visit || tk.it.pin != null ? [0] : IDLES) {
        const st = visit ? visit.start : Math.max(Math.round(s0.fin + idle + wk + tk.buf), tk.open);
        if (st > tk.lastP || st - 480 >= 899) break;
        const wi = Math.max(0, Math.round(st - 480)), w = W[i][wi], fin = visit ? visit.end : st + w + tk.dur;
        // 予測の微小な差だけで長い空きを作らず、並ぶ時間が5分以上減る候補を試す。
        if (idle > 0 && (st <= soon || w > soonW - 5)) continue;
        if (fin > M.close) continue;
        const mask = s0.mask | 1 << i;
        let dead = false;
        for (const j of mustIdx) if (!(mask >> j & 1) && tasks[j].lastP < fin) { dead = true; break; }
        if (dead) continue;
        // 列にいる時間と移動を評価する。休憩や当日の調整に使える自由時間は消そうとしない。
        const tot = s0.tot + C[i][wi] + wk + (visit ? visit.wait : 0), key = (mask * 64 + i) + "|" + dest;
        let Ls = nxt.get(key); if (!Ls) { Ls = []; nxt.set(key, Ls); }
        if (Ls.some(o => o.fin <= fin && o.tot <= tot)) continue;
        const keep = Ls.filter(o => !(fin <= o.fin && tot <= o.tot));
        keep.push({ mask, fin, tot, val: s0.val + tk.val, li: LI[dest] ?? -1, loc: dest, node: { i, st, w, idle, sk: visit && visit.sk, wcI: visit && tk.it.type === "wc" ? +dest.split(":")[1] : null, prev: s0.node } });
        nxt.set(key, keep.length > CAP ? keep.slice(-CAP) : keep);
        if (tk.it.pin != null) break;
      }
    }
    if (!nxt.size) break;
    let arr = []; for (const Ls of nxt.values()) arr.push(...Ls);
    if (arr.length > BEAM) {
      const rank = a => a.tot - VALUE * a.val, groups = new Map();
      for (const a of arr) { const g = a.mask & mustMask; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(a); }
      const per = Math.max(100, Math.ceil(BEAM / groups.size)); arr = [];
      for (const G of groups.values()) { G.sort((a, b) => rank(a) - rank(b) || a.fin - b.fin); arr.push(...G.slice(0, per)); }
    }
    arr.forEach(consider); layer = arr;
  }
  if (!best) return null;
  // at＝計算で決めた開始の目安。pin＝固定
  return { order: best.order, missed: tasks.filter((_, i) => !(best.c.mask >> i & 1)).map(t => t.it) };
}
// 確実: 去年の似た日すべての実際の待ちで回して、全部回れない日があれば「必ず」以外を1つずつ外す（一番よくなるものから）
// mustOnly: 必ずを最優先 … 「必ず」に乗れる日が似た日すべてになるまで、「必ず」以外を1つずつ外す（全部に乗れるかは問わない）
// ===== 最後の枠（受付終了の直前）をどれに使うか比べる =====
//  受付終了の直前は1日で1回しかない。夜しかやらない・夜の終わりに大きく下がる乗り物どうしで取り合いになる。
//  候補: 受付終了の見込みの15分前の予測が、昼（12時〜）からの最短＋5分以内で、昼（11〜17時。夜だけの乗り物は始まってから2時間）の中央より10分以上短いもの（多い順に4つまで）
//  候補ごとに「それを最後にして残りを組み直した案」を作って並べるだけで、予定は変えない（選んだときだけ反映）
function lastSlotCands(items) {
  return items.filter(it => it.type === "ride" && RIDES[it.key] && ["r", "h", "est"].includes(RIDES[it.key].src) && it.pin == null && !epOf(it.key) && M.prof[it.key]).map(it => {
    const k = it.key, p = M.prof[k], L = lastAt(k); if (L == null) return null;
    const day = p.filter(q => q[0] >= 660 && q[0] <= 1020), eve = p.filter(q => q[0] <= p[0][0] + 120);  // 夜だけの乗り物（昼の値がない）は、始まってから2時間と比べる
    const late = baseAt(k, L - 15).med, mid = medOf((day.length >= 3 ? day : eve).map(q => q[1])), aft = p.filter(q => q[0] >= Math.min(720, p[0][0]) && q[0] <= L - 15).map(q => q[1]);
    return aft.length && mid != null && late <= Math.min(...aft) + 5 && mid - late >= 10 ? { k, late: Math.round(late), mid: Math.round(mid), gain: Math.round(mid - late), last: L } : null;
  }).filter(Boolean).sort((a, b) => b.gain - a.gain).slice(0, 4);
}
function compareLastSlot(items, musts, opt = {}) {
  const start = opt.start != null ? { start: opt.start, loc: opt.loc } : {};
  const run = last => {
    const p = planMain(items.map(x => ({ ...x, at: undefined, mAt: undefined })), musts, last ? { ...opt, last } : opt); if (!p) return null;
    const s = simulate(p.order, start), rd = s.rows.filter(r => RIDES[r.it.key]), lr = rd[rd.length - 1];
    return { order: p.order, missed: p.missed, end: s.end, waitTot: s.waitTot, rides: rd.length, bad: s.bad, lastKey: lr && lr.it.key, lastStart: lr && lr.start, lastWait: lr && lr.wait };
  };
  const cands = lastSlotCands(items).filter(c => c.k !== opt.first);  // 「最初に乗る」に選んだ乗り物は最後の候補にしない
  return { cands, opts: cands.map(c => { const o = run(c.k); return o && o.lastKey === c.k ? { ...c, ...o } : { ...c, fail: true }; }) };
}
// ===== 空き時間をまとめて、もう1つ乗る =====
//  組み方は「待ちが5分以上減るなら待つ」ので、自由時間が細かく何か所にも入る。選んだものしか入れないので、空きが合計1〜3時間あっても乗り物は増えない。
//  その日の人気（popOf）上位の乗り物を1つ足して組み直し（ほかの順番・時刻もずらす）、もとの乗り物を1つも落とさずに入る案だけ返す。見るだけでは予定を変えない
//  予定にある乗り物（乗り終えたものも）は「もう1回」（2つ目は again の印。「必ず」にしない）。エクスプレス・パスは1回分なので、その乗り物は足さない
//  ニンテンドー（エリアの整理券）・子ども向け・ホラー（R-15 を含む）は、その組から選んでいるときだけ。当日に休止中のものは足さない
//  答え合わせは下の oneMoreTry の上（予測検証/free_consolidate/）
function oneMoreCands(items, closed = () => false) {
  const has = new Set([...items, ...(P().items || [])].map(x => x.key)), grpOK = g => S.sel.some(k => RIDES[k] && RIDES[k].grp === g);
  return Object.keys(RIDES).filter(k => { const R = RIDES[k]; return (R.src === "r" || R.src === "h") && avail(k, M.date) && M.prof[k] && !R.from_ && !epOf(k) && !closed(k) && (!["kids", "nintendo", "horror"].includes(R.grp) || grpOK(R.grp)); })
    .map(k => ({ k, pop: popOf(k), again: has.has(k) })).filter(c => c.pop != null).sort((a, b) => b.pop - a.pop).slice(0, 8);
}
// 答え合わせ（予測検証/free_consolidate/ consolidate.cjs。この2つの関数と既定の組み方 lean をそのまま使う。2025/9〜11・2026/9〜10、前日までで組み、その日の実際の待ちで回す）:
//  平均60分以上の乗り物が入る日 既定（ホラー期間外）84%・既定（ホラー期間、12個）44%・絶叫人気 88%。入れると乗れた数 +0.5〜0.8・「必ず」を逃す日はほぼ増えない（1/112日）・並ぶ合計 +15〜64分
function oneMoreTry(items, musts, opt, k) {
  const start = opt.start != null ? { start: opt.start, loc: opt.loc } : {}, nt = newItem("ride", k, (P().items || []).some(x => x.key === k) ? { again: true } : {}), rides0 = items.filter(x => RIDES[x.key]);
  const p = planMain([...items.map(x => ({ ...x, at: undefined, mAt: undefined })), nt], musts, opt);
  if (!p || !p.order.some(x => x.id === nt.id) || !rides0.every(x => p.order.some(o => o.id === x.id))) return null;
  const sim = simulate(p.order, start), me = sim.rows.find(r => r.it.id === nt.id);
  return sim.bad > simulate(items, start).bad ? null : { k, order: p.order, missed: p.missed, sim, start: me.start, wait: me.wait };
}
function planSure(items, musts, opt = {}, mustOnly = false) {
  let cur = items.slice(), p = planRoute(cur, musts, opt); if (!p) return p;
  const refs = M.crowd.refs, o2 = opt.start != null ? opt : null;
  const ok = r => (mustOnly ? !r.missed.some(m => musts.includes(m.k) && !m.ag) : !r.missed.length);
  const score = order => { const sim = simulate(order, o2 || {}); return refs.filter(x => ok(replayLive(sim, x, "same"))).length; };
  let sc = score(p.order); const dropped = [];
  while (sc < refs.length) {
    let best = null;
    for (const it of cur.filter(x => RIDES[x.key] && (!musts.includes(x.key) || x.again) && x.pin == null && x.qs == null && p.order.some(o => o.id === x.id))) {
      const c2 = cur.filter(x => x !== it), p2 = planRoute(c2, musts, { ...opt, beam: 300 }); if (!p2) continue;
      const s2 = score(p2.order); if (!best || s2 > best.s) best = { it, c2, p: p2, s: s2 };
    }
    if (!best || best.s <= sc) break;
    cur = best.c2; p = best.p; sc = best.s; dropped.push(best.it);
  }
  return { ...p, missed: [...p.missed, ...dropped], sure: { ok: sc, n: refs.length } };
}
const planMain0 = (items, musts, opt) => (S.style === "sure" ? planSure(items, musts, opt) : S.style === "must" ? planSure(items, musts, opt, true) : planRoute(items, musts, opt));
// 慎重に探した順番も候補にする。空きやすい時刻を狙う自由時間を残し、同じ個数なら列と移動の短い案を選ぶ。
let _safeGuard = false;
// もう1回（2つ目、again）はおまけ: もとの乗り物が入りきらないなら、2つ目を外して組み直す（2つ目は「入らない」に回す）
function planMain(items, musts, opt) {
  const p = planMain1(items, musts, opt), ag = items.filter(x => x.again);
  if (!ag.length || p && !p.missed.some(m => RIDES[m.key] && !m.again)) return p;
  const q = planMain1(items.filter(x => !x.again), musts, opt);
  return q && (!p || q.missed.length < p.missed.filter(m => !m.again).length) ? { ...q, missed: [...q.missed, ...ag] } : p;
}
function planMain1(items, musts, opt) {
  const p = planMain0(items, musts, opt);
  if (_safeGuard || !p || !(S.style === "lean" || !S.slack)) return p;
  const st = S.style, sl = S.slack; _safeGuard = true;
  try {
    S.style = "normal"; S.slack = true;
    const q = planMain0(items, musts, opt); if (!q) return p;
    S.style = st; S.slack = sl;
    const start = opt && opt.start != null ? { start: opt.start, loc: opt.loc } : {};
    const sq = simulate(q.order.map(it => ({ ...it, at: it.quietAt })), start), sp = simulate(p.order, start);
    q.order = sq.rows.map(r => ({ ...r.it, at: r.start }));
    const cost = s => s.waitTot + s.walkTot;
    return !sq.bad && (sq.rides > sp.rides || sq.rides === sp.rides && (cost(sq) < cost(sp) || cost(sq) === cost(sp) && sq.end <= sp.end)) ? q : p;
  } finally { S.style = st; S.slack = sl; _safeGuard = false; }
}

// ================= スケジュールの計算（順番どおりに回す） =================
let uid = 1;
const newItem = (type, key, extra = {}) => ({ id: "i" + (uid++) + Math.random().toString(36).slice(2, 6), type, key, pin: null, ...extra });
function itemName(it) {
  if (RIDES[it.key]) return RIDES[it.key].short;
  if (it.type === "meal") return it.light ? it.key + "（食べ歩き）" : it.key;
  if (it.type === "food") return FOOD.items[it.key] ? FOOD.items[it.key].name.replace(/（.*?）/, "") : it.key;
  if (it.type === "wc") return "トイレ";
  return it.title ? `${esc(it.title)} ${it.dur || 15}分` : `休憩 ${it.dur || 15}分`;
}
function simulate(items, opt = {}) {
  let t = opt.start ?? (M.open + (S.entry || 0) + (S.slack ? 15 : 0)), loc = opt.loc || GATE;
  const rows = [];
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx], next = items[idx + 1], nextLoc = next && RIDES[next.key] ? locOfRide(next.key) : null;
    let dest = loc, wait = 0, d = 0, info = "", flag = "", sk = null;
    if (RIDES[it.key]) {
      dest = locOfRide(it.key); d = durOf(it.key);
    } else if (it.type === "meal") {
      const b = it.store ? { loc: "store:" + it.store, sk: it.store } : it.light ? bestStore("chicken", loc, t, nextLoc) || bestMeal(loc, t) : bestMeal(loc, t); dest = b.loc; sk = b.sk; d = it.light ? 12 : it.key === "昼ごはん" ? 40 : 30;
    } else if (it.type === "food") {
      const b = it.store ? { loc: "store:" + it.store, sk: it.store } : bestStore(it.key, loc, t, nextLoc); dest = b.loc; sk = b.sk; d = STORE_USE[FOOD.stores[sk].type] + 2;
    } else if (it.type === "wc") {
      const b = it.wcI != null ? { loc: "wc:" + it.wcI, i: it.wcI } : bestWC(loc, t, nextLoc); dest = b.loc; d = WC_USE; info = FOOD.toilets[b.i].name;
    } else { d = it.dur || 15; if (it.loc) dest = it.loc; }  // 相談メモから写した休憩・食事は、その場所まで歩く
    const qd = it.qs != null && RIDES[it.key] && RIDES[it.key].src !== "ticket" && RIDES[it.key].src !== "show" ? it : null;  // 並び始めた（当日タブの「今から並び始める」）: その時刻から、入れた待ちで進む
    const wk = qd ? 0 : dest === loc ? 0 : walkMin(loc, dest);
    const arrive = qd ? qd.qs : t + wk;
    let start = qd ? qd.qs : Math.max(arrive, it.pin ?? it.at ?? 0);
    if (it.type === "meal" && it.at == null) start = Math.max(start, it.key === "昼ごはん" ? 660 : 1020);  // ごはんの窓の始まり。手で時刻を決めた（at）ときは従う
    if (RIDES[it.key]) {
      const r = RIDES[it.key], ps = r.src === "show" && it.pin != null;  // 固定したショーは固定の時刻で見る（自動で読んだ今日の時刻 showLive では動かさない）
      if (!ps) start = Math.max(start, openAt(it.key));
      if (r.src !== "ticket" && r.src !== "show") wait = qd ? qd.qw : planWait(it.key, start, it.again);
      if (start > (ps ? it.pin : lastAt(it.key)) + (r.src === "show" ? r.early : r.src === "ticket" ? 15 : 0)) flag = r.src === "show" ? "間に合わない" : r.src === "ticket" ? "整理券の時間に遅れる" : "締め切り後";
      if (!M.prof[it.key] && r.src !== "ticket" && r.src !== "show") flag = flag || "この日は記録なし";
      if (!avail(it.key, M.date)) flag = "この日はやっていない";
    } else if (sk) { wait = storeQueue(sk, start); info = FOOD.stores[sk].name; }
    else if (it.type === "wc") wait = wcQueue(+dest.split(":")[1], start);
    if (it.pin != null && arrive > it.pin + 10 && !flag) flag = RIDES[it.key] && epOf(it.key) && RIDES[it.key].src !== "ticket" ? `エクスプレス・パスの時刻（${hm(it.pin)}）に${Math.round(arrive - it.pin)}分遅れる` : RIDES[it.key] && RIDES[it.key].src === "ticket" ? `整理券の時刻（${hm(it.pin)}）に${Math.round(arrive - it.pin)}分遅れる` : `固定の時刻（${hm(it.pin)}）に${Math.round(arrive - it.pin)}分遅れる`;
    const end = start + wait + d;
    if (end > M.close && !flag) flag = "閉園後";
    rows.push({ it, from: loc, to: dest, walk: wk, arrive, start, wait, end, d, info, flag, idle: Math.max(0, start - arrive) });
    t = end; loc = dest;
  }
  // 各予定の窓: early＝早く着けたら並べる時刻（空きがあれば前倒しできる）／late＝遅れても、あとの予定を崩さずに並べる最後の時刻。うしろから、次の予定の late・締め切り・時刻の決まった予定から数える
  let L = Infinity;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i], tk = taskOf(r.it), dl = r.it.pin != null && !(RIDES[r.it.key] && epOf(r.it.key)) ? r.it.pin : tk.last;
    const nx = rows[i + 1], cap = nx ? nx.late - nx.walk - (r.end - r.start) : Infinity;
    r.late = Math.floor(Math.min(dl, cap)); r.early = Math.round(r.arrive); L = r.late;
  }
  const rides = rows.filter(r => RIDES[r.it.key] && !r.flag).length;
  return { rows, end: t, rides, waitTot: rows.reduce((a, r) => a + (RIDES[r.it.key] ? r.wait : 0), 0), walkTot: rows.reduce((a, r) => a + r.walk, 0), bad: rows.filter(r => r.flag).length };
}

// ===== 過ぎた日の答え合わせ（実際の記録と、その日より前の記録で作った予測）=====
//  lead: 0＝前日までの記録（前日の夜に計画）／30＝31日前までの記録。作り方は 予測検証/eval_pred.cjs と同じ（天気は lead>7、営業時間は lead>31 で使わない）。
//  実際は DAYMAP の記録（30分ごと。ホラーは1時間ごと）。M・S.date・S.plans・cutoffDay などは呼んだあとで元に戻す。結果は日と lead ごとに控える
const retroCache = {};
function retroDay(D, lead) {
  const key = D + "|" + lead + "|" + DAYS.length, x = DAYMAP[D];
  if (retroCache[key]) return retroCache[key];
  if (!x || !x.avg || !Object.keys(x.s).length) return null;
  const M0 = M, d0 = S.date, p0 = S.plans[D], cut0 = cutoffDay, ex0 = excludeDay, bl0 = evalBlind;
  try {
    S.date = D; S.plans[D] = { items: [], done: {}, over: {}, ticketAt: {} };
    excludeDay = null; cutoffDay = addDays(D, -lead); evalBlind = { wx: lead > 7 ? D : null, hours: lead > 31 ? D : null };
    M = buildModel(D);
    const rides = [];
    for (const k of M.keys) {
      const r = RIDES[k]; if (!M.prof[k] || !(r.src === "r" || r.src === "h")) continue;
      const pts = [];
      if (r.src === "r") { if (r.from_ && !fromDay(D)) continue; for (let t = Math.max(M.open, r.open || 0) + 30; t <= M.close - 30; t += 30) { const a = dayWait(k, x, t); if (!a || a.closed || a.w == null) continue; pts.push([t, a.w]); } }
      else { const s = x.h[k]; if (!s) continue; for (let i = 0; i < 14; i++) { const v = dec(s, i); if (v != null) pts.push([(8 + i) * 60 + 30, v]); } }
      if (!pts.length) continue;
      const cells = pts.map(([t, a]) => { const p = waitAt(k, t); return { t, a, med: p.med, p10: p.p10, p90: p.p90 }; });
      const line = []; for (let t = Math.max(M.open, r.open || 0); t <= M.close; t += 30) { const p = waitAt(k, t); if (p && p.med != null) line.push([t, p.med, p.p10, p.p90]); }
      rides.push({ k, cells, line });
    }
    return (retroCache[key] = { d: D, lead, predAvg: M.crowd.avg, actAvg: x.avg, refs: M.crowd.refs.length, open: M.open, close: M.close, rides });
  } finally { M = M0; S.date = d0; if (p0) S.plans[D] = p0; else delete S.plans[D]; cutoffDay = cut0; excludeDay = ex0; evalBlind = bl0; }
}
// 答え合わせの表（時間帯の表と同じ形）: 乗り物×1時間ごとの実際（記録の H:15 と H:45 の平均）と予測（同じ2時刻の平均）
//  t0 なし＝前日の夜までの記録の予測。t0（記録の時刻 H:15）あり＝その日の t0 と30分前・60分前の実際の待ちを読み込んでいたら（当日の補正・似た日・似た推移・機械学習。当日タブと同じ）、t0 より後の時間の予測
function retroHours(D, t0) {
  const key = "h|" + D + "|" + (t0 || 0) + "|" + DAYS.length, x = DAYMAP[D];
  if (retroCache[key]) return retroCache[key];
  if (!x || !x.avg || !Object.keys(x.s).length) return null;
  const M0 = M, d0 = S.date, p0 = S.plans[D], cut0 = cutoffDay, ex0 = excludeDay, bl0 = evalBlind;
  try {
    S.date = D; S.plans[D] = { items: [], done: {}, over: {}, ticketAt: {}, obs: [] };
    excludeDay = null; cutoffDay = D; evalBlind = { wx: null, hours: null };
    M = buildModel(D);
    const keys = M.keys.filter(k => M.prof[k] && RIDES[k].src === "r" && (!RIDES[k].from_ || fromDay(D)));
    if (t0) {
      const snap = t => Object.fromEntries(keys.map(k => { const w = dayWait0(k, x, t); return w && !w.closed && w.w != null ? [k, w.w] : null; }).filter(Boolean));
      const w2 = snap(t0); for (const [k, v] of Object.entries(w2)) setOver(k, v, t0, "auto");
      P().obs = [{ t: t0 - 60, w: snap(t0 - 60) }, { t: t0 - 30, w: snap(t0 - 30) }, { t: t0, w: w2 }];
    }
    const h0 = Math.floor(M.open / 60), h1 = Math.ceil(M.close / 60) - 1, hours = [], cells = {}, lines = {};
    for (let h = h0; h <= h1; h++) hours.push(h);
    for (const k of keys) {
      const a = histHour(D, k) || {}; cells[k] = {};
      for (const h of hours) {
        const ts = [h * 60 + 15, h * 60 + 45].filter(t => t >= M.open && t <= M.close);
        if (a[h] == null || !ts.length) continue;
        cells[k][h] = { a: a[h], p: t0 && h * 60 + 15 <= t0 ? null : ts.reduce((s, t) => s + waitAt(k, t).med, 0) / ts.length };
      }
      if (t0) { lines[k] = []; for (let t = t0; t <= M.close; t += 15) lines[k].push([t, waitAt(k, t).med]); }  // 読み込んだあとの予測の線（グラフ用）
    }
    return (retroCache[key] = { d: D, t0: t0 || null, keys, hours, cells, lines });
  } finally { M = M0; S.date = d0; if (p0) S.plans[D] = p0; else delete S.plans[D]; cutoffDay = cut0; excludeDay = ex0; evalBlind = bl0; }
}
// 1つのまとまり（乗り物ひとつ・全部）の比べ方: 実際の平均・予測の平均・ずれ（実際−予測の平均。＋は実際が長い）・平均の絶対ずれ・予測の幅（10〜90%）に入った割合
function retroStats(cells) {
  const n = cells.length; if (!n) return null;
  const s = f => cells.reduce((a, c) => a + f(c), 0), r1 = v => Math.round(v * 10) / 10;
  return { n, act: r1(s(c => c.a) / n), pred: r1(s(c => c.med) / n), bias: r1(s(c => c.a - c.med) / n), mae: r1(s(c => Math.abs(c.a - c.med)) / n), cover: Math.round(100 * cells.filter(c => c.a >= c.p10 && c.a <= c.p90).length / n) };
}
// ===== 整理券の回の比べ方 =====
//  回ごとに、似た日の実際の待ちのまま回した1日ごとの点（乗れた数×VALUE−待ち）で比べる。1日ごとのばらつき（点の標準偏差で130〜200）は、回による差（数十点）より大きい。
//  そこで、一番よい回との差を同じ日どうしで対にして（per[i] は i 番目の似た日の点）、差が誤差（2SE）より大きく、かつ10分より大きく悪い回だけ「悪い」、それ以外は「ほぼ同じ」（same）とする
function ticketSlotRank(res) {
  const mean = v => v.reduce((a, b) => a + b, 0) / v.length, sd = v => { const m = mean(v); return Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, v.length - 1)); }, n = res[0].per.length;
  res.forEach(r => (r.m = mean(r.per)));
  const best = res.reduce((a, b) => (b.m > a.m ? b : a));
  for (const r of res) { const d = r.per.map((x, i) => x - best.per[i]), se = r === best ? 0 : sd(d) / Math.sqrt(n); r.loss = Math.max(0, Math.round(best.m - r.m)); r.same = r === best || r.loss <= MOVE_COST.green || mean(d) > -2 * se; }  // 差が10分（MOVE_COST.green）以内は、どの日も同じ向きでも、気にするほどではない
  return { best, n, dayVar: Math.round(sd(best.per)) };
}
// ===== 自動提案の予定を入れ替えたときの損（帯の候補の色。simulate を境目ごとに1回ずつ回して比べる）=====
//  損 = 待ち・歩きの増減か、終わりの遅れの大きいほう。新しく「間に合わない・締め切り後・閉園後」などの注意が出たら、損が小さくても赤。色の分け目は MOVE_COST
const autoIssueKey = (r, t) => r.it.id + "|" + String(t).replace(/[0-9:]+/g, "#");
function autoMoveCost(before, after) {
  const W = sm => sm.rows.reduce((a, r) => a + r.wait, 0), had = new Set(before.rows.filter(r => r.flag).map(r => autoIssueKey(r, r.flag)));
  const issues = after.rows.filter(r => r.flag && !had.has(autoIssueKey(r, r.flag))).map(r => ({ id: r.it.id, name: RIDES[r.it.key] ? RIDES[r.it.key].short : r.it.title || r.it.key || "休憩", text: r.flag }));
  const wait = Math.round(W(after) - W(before)), walk = Math.round(after.walkTot - before.walkTot), late = Math.max(0, Math.round(after.end - before.end));
  const endD = Math.round(after.end - before.end), c = { wait, walk, total: wait + walk, endB: before.end, endA: after.end, late, cost: Math.max(wait + walk, late), loss: Math.abs(endD) > Math.abs(wait + walk) ? endD : wait + walk, issues };  // loss: 見せる数字。待ち歩きの増減か終わりの前後の大きいほう（符号つき。動かして元に戻すと、ちょうど逆の数字になる）
  c.color = manualCostColor(c); return c;
}
// 並びを変えたあとの空き: 計画が各予定に付けた「この時刻から」（at）は、その並びでの開始時刻の写しなので、並びが変わると古い時刻のままになり、意味のない空きができる（前の予定を詰めても、次の予定がその時刻まで動かない）。
//  変える前に空き（idle）が5分未満だった予定の at は写しなので外す（= 前の予定を詰める）。空きのあった予定の at は、待つために選んだ時刻（利用者が付けた分も）なので残す。時刻の決まった予定（pin）と except の予定はそのまま
const autoKeepHolds = (items, before, except = null) => { const hold = new Set(before.rows.filter(r => r.idle >= 5 || r.it.pin != null).map(r => r.it.id)); return items.map(x => (x.at != null && x.id !== except && !hold.has(x.id) ? (({ at, ...y }) => y)(x) : x)); };
// items（順番どおりの予定）の id を、残りの並びの各境目（0〜n）に入れた案を作って評価する。b: 境目の番号（その予定の前）、same: 今の位置、pos: その境目の時刻（動かす予定を抜いた並びで、前の予定の終わり）、me: 動かす予定がそこでいつ並び始め何分待つか
//  動かす予定の「この時刻から」（at）は外す。時刻の決まった予定は呼ぶ側で選ばせない。入れ替えた案の予定は items そのもの（確定するときそのまま使える）
//  snaps: これまでに動かす前だった予定（新しい順でなくてよい）。入れ替え先の並びがその1つと同じなら、そのときの「この時刻から」に戻す（動かして元に戻すと、損の符号だけ逆で同じ大きさになる）
const autoSnapAt = (cand, snaps) => {
  const ids = cand.map(x => x.id).join();
  for (const sn of snaps) { const m = new Map(sn.map(x => [x.id, x])), ord = sn.filter(x => cand.some(c => c.id === x.id)); if (ord.length === cand.length && ord.map(x => x.id).join() === ids) return cand.map(x => { const { at, ...y } = x, a = m.get(x.id).at; return a != null ? { ...y, at: a } : y; }); }
  return null;
};
function autoMoveOptions(items, id, opt = {}, snaps = []) {
  const i = items.findIndex(x => x.id === id); if (i < 0) return [];
  const before = simulate(items, opt), rest = items.filter(x => x.id !== id), x = { ...items[i] }, L = before.rows.filter(r => r.it.id !== id), out = [];
  delete x.at;
  const t0 = before.rows[0].arrive - before.rows[0].walk;
  for (let b = 0; b <= rest.length; b++) {
    const pos = b ? L[b - 1].end : t0;
    if (b === i) { out.push({ b, same: true, pos }); continue; }
    const cand = [...rest.slice(0, b), x, ...rest.slice(b)], its = autoSnapAt(cand, snaps) || autoKeepHolds(cand, before), sim = simulate(its, opt), me = sim.rows.find(r => r.it.id === id);
    out.push({ b, pos, items: its, sim, cost: autoMoveCost(before, sim), me: { start: me.start, arrive: me.arrive, wait: Math.round(me.wait), end: me.end } });
  }
  return out;
}
// 当日の「次の候補」: 残りの乗り物を1つずつ先頭（次に乗る）に入れた案。並びのほかは autoMoveOptions の境目 0 と同じ作り方。anchor の予定（時刻が決まったもの・並び中）は動かさない。先頭に並び中なら候補なし（次の時刻が決まった予定の前には入れられる）
function autoNextOptions(items, opt = {}, anchor = () => false, snaps = []) {
  if (items.length < 2 || items[0].qs != null) return [];
  const before = simulate(items, opt);
  return items.slice(1).filter(x => RIDES[x.key] && !anchor(x)).map(x => {
    const { at, ...y } = x, cand = [y, ...items.filter(z => z.id !== x.id)], its = autoSnapAt(cand, snaps) || autoKeepHolds(cand, before), sim = simulate(its, opt), me = sim.rows[0];
    return { id: x.id, key: x.key, b: 0, items: its, sim, cost: autoMoveCost(before, sim), me: { start: me.start, arrive: me.arrive, wait: Math.round(me.wait), end: me.end } };
  });
}
// 自由時間（id の予定の前の空き）を、別の予定の前へ動かした案。空きの長さは変えず、元の所は詰め、動かし先の予定の「この時刻から」（at）に空きの分を足す。時刻の決まった予定の前へは置けない（anchor で判定）
function autoFreeMoveOptions(items, id, opt = {}, anchor = () => false) {
  const before = simulate(items, opt), row = before.rows.find(r => r.it.id === id); if (!row || row.idle < 5) return [];
  const gap = Math.round(row.idle), out = [], base = autoKeepHolds(items.map(x => { if (x.id !== id) return x; const { at, ...y } = x; return y; }), before, id), sim0 = simulate(base, opt);
  const i = items.findIndex(x => x.id === id);
  items.forEach((x, j) => {
    if (j === i) { out.push({ b: j, same: true }); return; }
    const r0 = sim0.rows.find(r => r.it.id === x.id); if (anchor(x) || !r0) return;
    const its = base.map(y => (y.id === x.id ? { ...y, at: Math.ceil(r0.arrive + gap) } : y)), sim = simulate(its, opt), me = sim.rows.find(r => r.it.id === x.id);
    if (me.idle < gap - 1) return;  // 空きが入らない（閉園・時刻の決まった予定のため）
    out.push({ b: j, items: its, sim, cost: autoMoveCost(before, sim), me: { start: me.start, arrive: me.arrive, wait: Math.round(me.wait), end: me.end } });
  });
  return out;
}
// 予定の開始時刻をずらした案（順番は変えない）。id の予定を t（分）から並び始めにする。前の空きが削れる（早める）・増える（遅らせる）。早めるときは、次の予定の開始は今のまま保ち（at を付ける）、空きは後ろに流れる。遅らせるときは、次の予定は押されて後ろに流れる
//  t は並び始めの時刻（その予定の到着より前にはできない）。時刻が変わらないなら null
function autoSlideOption(items, id, t, opt = {}) {
  const before = simulate(items, opt), i = before.rows.findIndex(r => r.it.id === id); if (i < 0) return null;
  const row = before.rows[i], nx = before.rows[i + 1], s = Math.max(Math.round(t / 5) * 5, Math.ceil(row.arrive)); if (Math.abs(s - row.start) < 1) return null;
  const its = items.map(x => (x.id === id ? { ...x, at: s } : nx && x.id === nx.it.id && s < row.start && nx.idle < 5 && (nx.it.at == null || nx.it.at < nx.start - 0.5) ? { ...x, at: Math.floor(nx.start) } : x)), sim = simulate(its, opt), me = sim.rows.find(r => r.it.id === id);
  return { slide: true, items: its, sim, cost: autoMoveCost(before, sim), me: { start: me.start, arrive: me.arrive, wait: Math.round(me.wait), end: me.end, idle: Math.round(me.idle) } };
}
const restItems = () => P().items.filter(x => !P().done[x.id]);
const liveOpt = () => (P().live ? { start: P().live.now, loc: P().live.loc } : {});
const curSim = () => simulate(restItems(), liveOpt());

// ================= 予定をリンクで共有（#share=…）。乗り物は Object.keys(RIDES) の番号にし、版 v と乗り物の並び c が合わない・壊れている・知らないキーや項目は取り込まない =================
const SHARE_T = ["ride", "ticket", "show", "meal", "food", "wc", "rest"], SHARE_R = ["ride", "ticket", "show"], SHARE_MAX = 8000;
const SHARE_F = ["type", "key", "pin", "at", "title", "dur", "loc", "light", "again", "store", "wcI", "manual", "lock"];  // 送る項目はこれだけ（済んだ印・並び始め qs/qw・計算の途中で付く quietAt・自動で選んだ店やトイレは送らない）
const shareType = k => (RIDES[k].src === "ticket" ? "ticket" : RIDES[k].src === "show" ? "show" : "ride");  // 乗り物のふつうの種類は書かずに短くする
const shareSum = () => [...Object.keys(RIDES).join()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0).toString(36);  // 乗り物の並びの照合（数が同じでも入れ替わっていれば合わない）
function encodeShare(o) {
  const RK = Object.keys(RIDES), ks = a => (a || []).filter(k => RIDES[k]).map(k => RK.indexOf(k)), ko = m => Object.fromEntries(Object.entries(m || {}).filter(([k]) => RIDES[k]).map(([k, v]) => [RK.indexOf(k), v]));
  const its = a => (Array.isArray(a) ? a.filter(it => (!SHARE_R.includes(it.type) || RIDES[it.key]) && (it.type !== "food" || FOOD.items[it.key])).map(it => { const x = Object.fromEntries(SHARE_F.filter(k => it[k] != null && !(k === "store" && it.autoStore) && !(k === "wcI" && it.autoWC)).map(k => [k, it[k]])); if (typeof x.title === "string") x.title = x.title.replace(/[<>"\u0000-\u001f\u007f]/g, "").slice(0, 80); if (RIDES[x.key]) { if (x.type === shareType(x.key)) delete x.type; x.key = RK.indexOf(x.key); } return x; }) : null);
  const m = o.manual, j = JSON.stringify({ v: 1, c: shareSum(), d: o.d, sel: ks(o.sel), must: ks(o.must), entry: o.entry, style: o.style, slack: o.slack, mode: o.mode, showAt: ko(o.showAt), mealAt: Object.fromEntries(Object.entries(o.mealAt || {}).filter(([, v]) => FOOD.stores[v])), ep: ko(o.ep), ta: ko(o.ticketAt), items: its(o.items), manual: m ? { entry: m.entry, opening: m.opening, want: ks(m.want || m.wish), items: its(m.items) } : null, sp: o.speed ?? null, wx: o.wx || null });  // 歩く速さ・その日の天気も送る（受け取った端末で見込みが変わらないように）
  return btoa(String.fromCharCode(...new TextEncoder().encode(j))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeShare(s) {
  try {
    if (typeof s !== "string" || !s || s.length > SHARE_MAX || !/^[\w-]+$/.test(s)) return null;
    const o = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)))), RK = Object.keys(RIDES);
    if (!o || o.v !== 1 || o.c !== shareSum() || !/^\d{4}-\d\d-\d\d$/.test(o.d)) return null;
    const bad = () => { throw new Error("share"); }, tm = v => v == null || (Number.isFinite(v) && v >= 0 && v < 1440), rk = i => (Number.isInteger(i) && RK[i]) || bad();
    const has = (t, k) => typeof k === "string" && Object.hasOwn(t, k), B = v => typeof v === "boolean", wcOk = v => Number.isInteger(v) && v >= 0 && v < FOOD.toilets.length;
    const okLoc = l => { const [t, v, z] = typeof l === "string" ? l.split(":") : []; return z === undefined && (t === "pin" ? has(MAPD.pins, v) : t === "store" ? has(FOOD.stores, v) : t === "wc" && /^\d+$/.test(v) && wcOk(+v)); };
    // 項目ごとに型と値を確かめる（文字は画面に出るので、タグや引用符になる文字は受け取らない）
    const OKF = { again: B, pin: tm, at: tm, title: v => typeof v === "string" && v.length <= 80 && !/[<>"\u0000-\u001f\u007f]/.test(v),  /* タグや引用符になる文字・制御文字は受け取らない（送る側で取り除く） */ dur: v => Number.isFinite(v) && v >= 5 && v <= 240, loc: okLoc, light: B, manual: B, lock: B, store: v => has(FOOD.stores, v), wcI: wcOk };
    const OKK = { meal: k => k === "昼ごはん" || k === "夜ごはん", food: k => has(FOOD.items, k), wc: k => k == null || k === "wc", rest: k => k == null };
    const ks = a => (Array.isArray(a) ? a.map(rk) : bad()), ko = (m, ok) => Object.fromEntries(Object.entries(m || {}).map(([i, v]) => [rk(+i), ok(v) ? v : bad()]));
    const its = (a, man) => (a == null ? null : Array.isArray(a) ? a.map(x => { const { key, type: t0, ...r } = x && typeof x === "object" ? x : bad(), k = typeof key === "number" ? rk(key) : key ?? null, type = t0 ?? (has(RIDES, k) ? shareType(k) : null); if (!SHARE_T.includes(type) || (SHARE_R.includes(type) ? !has(RIDES, k) : !OKK[type](k)) || Object.entries(r).some(([f, v]) => !Object.hasOwn(OKF, f) || !OKF[f](v)) || (man && r.at == null)) bad(); return newItem(type, k, r); }) : bad());
    if (!["normal", "must", "lean", "sure"].includes(o.style) || typeof o.slack !== "boolean" || !["auto", "manual"].includes(o.mode) || !Number.isInteger(o.entry) || !tm(o.entry)) return null;
    const mealAt = Object.fromEntries(Object.entries(o.mealAt || {}).map(([m, v]) => (["lunch", "dinner"].includes(m) && has(FOOD.stores, v) ? [m, v] : bad())));
    const m = o.manual, op = m && m.opening, want = m ? ks(m.want) : null;
    if (m && (!Number.isFinite(m.entry) || !tm(m.entry))) return null;
    const manual = m ? { entry: m.entry, cursor: m.entry, mode: "next", focus: "", wish: want, want, wantV: 1, ...(op ? { opening: { enabled: !!op.enabled, wait: Number.isFinite(op.wait) && op.wait >= 0 && op.wait <= 180 ? op.wait : 0 } } : {}), items: its(m.items, true) || [] } : undefined;
    if (o.sp != null && ![0.8, 1, 1.25].includes(o.sp) || o.wx != null && !["晴", "時雨", "後雨", "雨"].includes(o.wx)) return null;
    const out = { d: o.d, sel: ks(o.sel), must: ks(o.must), entry: o.entry, style: o.style, slack: o.slack, mode: o.mode, showAt: ko(o.showAt, v => tm(v) && v != null), mealAt, speed: o.sp ?? null, wx: o.wx ?? null,
      plan: { items: its(o.items), done: {}, over: {}, live: null, ep: ko(o.ep, v => v && typeof v === "object" && tm(v.at)), ticketAt: ko(o.ta, v => tm(v) && v != null), ...(manual ? { manual } : {}) } };
    // 取り込む前に、その日の予定として一度計算してみる（落ちるなら取り込まない）。試したあとは元の日付・予定・モデルに戻す
    const d0 = S.date, p0 = S.plans[o.d], m0 = M;
    try { S.date = o.d; S.plans[o.d] = out.plan; M = buildModel(o.d); simulate(out.plan.items || []); if (manual) manualRows(manual); } finally { S.date = d0; if (p0) S.plans[o.d] = p0; else delete S.plans[o.d]; M = m0; }
    return out;
  } catch (e) { return null; }
}

// ================= 自分たちで組む時間表 =================
// 自動の予定とは別に、選んだ時刻をそのまま保存する。待ちは通常列の中央値（EP指定があれば10分）。
function manualState() {
  // 今日の日付で開いたときは、もう過ぎた入園時刻ではなく今（5分単位で切り上げ）から考える
  const now = (() => { const n = new Date(); return S.date === TODAY ? Math.ceil((n.getHours() * 60 + n.getMinutes()) / 5) * 5 : -1; })(), e0 = Math.max(M.open + (S.entry || 0), Math.min(now, M.close - 30));
  if (!P().manual) P().manual = { entry: e0, cursor: e0, mode: "next", focus: "", wish: (S.sel || []).filter(k => RIDES[k] && ["r", "h", "est"].includes(RIDES[k].src)), items: [] };
  const p = P().manual; if (!p.wantV) { p.want = [...new Set([...(p.wish || []),...(p.want || [])])]; p.wantV = 1; }  // 写真で1つ足しても、既定の候補を残す（写真で want が1件だけになった古い計画にも一度だけ補う）
  return p;
}
const manualClock = t => Number.isFinite(t) && t >= 0 && t < 1440;
// 1件ぶんの時刻・待ち・歩き・注意（end/loc: 前の予定の終わりと場所。manualRows と manualPack で同じ計算を使う）
function manualRow(plan, it, index, end, loc, seen) {
  const r = RIDES[it.key], from = loc, to = r ? locOfRide(it.key) : it.loc || loc;
  const walk = walkMin(from, to), arrive = end + walk, start = it.at, issues = [];
  const timed = r && ["ticket", "show"].includes(r.src), hasWait = r && !timed && !!M.prof[it.key];
  const normalW = hasWait ? epOf(it.key) ? {med:EPW,p10:EPW,p90:EPW} : waitAt(it.key, start) : null;
  const opening = index === 0 && hasWait && !epOf(it.key) && plan.opening?.enabled && Number.isFinite(plan.opening.wait) && plan.opening.wait >= 0 && plan.opening.wait <= 180 && plan.entry <= M.open && start >= arrive && start <= arrive+5 && start <= M.open+30;
  const w = opening ? {med:plan.opening.wait,p10:plan.opening.wait,p90:plan.opening.wait} : normalW;
  const d = r ? durOf(it.key) : it.dur || 30, finish = Math.ceil(start + (w ? w.med : 0) + d);
  if (start < arrive) issues.push(index === 0 ? `入口から歩くと${hm(arrive)}ごろ着。${Math.ceil(arrive - start)}分足りません` : `前の予定から到着は${hm(arrive)}ごろ。${Math.ceil(arrive - start)}分足りません`);
  if (r) {
    if (!avail(it.key, M.date)) issues.push("この日は運営期間外です");
    if (start < (r.src === "show" ? M.open : openAt(it.key))) issues.push(`${hm(r.src === "show" ? M.open : openAt(it.key))}より前は運営前です`);
    if (r.src !== "show" && epOf(it.key)?.at == null && start > lastAt(it.key)) issues.push("受付終了の見込みを過ぎています");
    if (!timed && !hasWait) issues.push("待ち時間の記録が足りません");
    if (epOf(it.key)?.at != null && Math.abs(start-epOf(it.key).at) > 10) issues.push(`エクスプレス・パスは${hm(epOf(it.key).at)}の時間指定です`);
    if (r.after && !seen.has(r.after)) issues.push(`${RIDES[r.after].short}のあとに取る整理券です`);
    seen.add(it.key);
  }
  if (finish > M.close) issues.push("閉園後までかかる予測です");
  const row = {it,from,to,walk,arrive,start,end:finish,w,normalW,opening:!!opening,d,issues,idle:Math.max(0,start-arrive)};
  return row;
}
function manualRows(plan) {
  let end = Math.max(M.open, plan.entry), loc = GATE;
  const seen = new Set();
  return plan.items.slice().sort((a, b) => a.at - b.at).map((it, index) => {
    const row = manualRow(plan, it, index, end, loc, seen);
    end = Math.max(end, row.end); loc = row.to;
    return row;
  });
}
// ===== 1日の帯は「順番＋自由時間」で組む =====
// free: その予定の前の自由時間（分）。開始 = max(前の終わり + free + 歩く, 乗り物が開く時刻)。時刻の決まった予定（ショー・整理券・時間指定のEP・決定済み）は動かさない錨
const MOVE_COST = { green: 10, yellow: 30 };  // 動かしたときの損（分）の色の分け目（緑＝ほぼ損なし・黄＝少し損・赤＝大きい、または注意が増える）。ここだけ変えれば色が変わる
const manualAnchor = it => !!(it.lock || (RIDES[it.key] && (["show", "ticket"].includes(RIDES[it.key].src) || epOf(it.key)?.at != null)));
const manualNow = () => (S.date === TODAY && typeof clockMin === "function" ? Math.ceil(clockMin() / 5) * 5 : -1);  // 今日は過ぎた時刻に入れない（manualPackLeft と同じ）
const manualLow = it => Math.max(RIDES[it.key] ? openAt(it.key) : 0, manualNow());
const manualFreeFor = (t, ready, lb) => { const m = Math.max(ready, lb); return t > m ? t - m : 0; };  // 開く時刻・時刻待ちで説明できない空きだけを自由時間にする
const manualFreeOf = r => (manualAnchor(r.it) ? 0 : manualFreeFor(r.start, r.arrive, manualLow(r.it)));
// 詰めた時刻にならない所に置いた予定（前と重なる・運営前・入園前・今より前）。帯のほかの操作では動かさない
const manualStray = r => !manualAnchor(r.it) && r.start < Math.max(r.arrive, manualLow(r.it)) - 0.5;
// order の順に at を書き直す（items は書き換える）。keep: id → 今の時刻。その予定はできるだけ今の時刻のまま（前の自由時間で吸収し、足りなければずれる）
function manualPack(plan, order = manualRows(plan).map(r => r.it), keep = null) {
  let end = Math.max(M.open, plan.entry), loc = GATE;
  const seen = new Set();
  return order.map((it, index) => {
    const ready = end + walkMin(loc, RIDES[it.key] ? locOfRide(it.key) : it.loc || loc), lb = manualLow(it);
    if ((manualAnchor(it) || it.stay) && Number.isFinite(it.at)) it.free = 0;
    else {
      if (keep && keep.has(it.id)) it.free = manualFreeFor(keep.get(it.id), ready, lb);
      it.free = Math.max(0, Math.round(it.free || 0)); it.at = Math.max(ready, lb) + it.free;
    }
    const row = manualRow(plan, it, index, end, loc, seen);
    end = Math.max(end, row.end); loc = row.to;
    return row;
  });
}
// 時刻で置いた予定から自由時間を出す（時刻は変えない）
function manualNormalize(plan) { for (const r of manualRows(plan)) r.it.free = manualFreeOf(r); return plan; }
// 帯の操作を写しに当てて返す（元の plan は変えない）。to: 境目の番号（その予定の前。動かす予定を抜いた並びで数える）
//  move/add: 前の予定のすぐあとに入る。自由時間のある予定は今の時刻のまま（自由時間が縮む）、足りなければずれる。抜いた所は自由時間になる
//  freeMove: 自由時間のかたまりを別の境目へ（間の予定は詰まる。時刻の決まった予定の前へは動かさない）。free: 自由時間の長さを変える（次の自由時間までの予定がずれる）
//  時刻の決まった予定を追い越して順番が変わる操作は null（利用者の決めた順番を勝手に並べ替えない）。重なり・運営前などに置いた予定は今の時刻のまま
function manualApply(plan, op) {
  const rows = manualRows(plan), items = rows.map(r => ({ ...r.it, free: manualFreeOf(r), stay: manualStray(r) })), old = new Map(rows.map(r => [r.it.id, r.start])), keep = new Map();
  const hold = list => list.forEach(it => { if (it.free > 0) keep.set(it.id, old.get(it.id)); }), i = op.id ? items.findIndex(x => x.id === op.id) : -1;
  if (op.id && i < 0) return null;
  if (op.kind === "move" || op.kind === "remove") {
    const [x] = items.splice(i, 1); hold(items);
    if (items[i]) keep.set(items[i].id, old.get(items[i].id));
    if (op.kind === "move") { if (manualAnchor(x) || !(op.to >= 0 && op.to <= items.length)) return null; x.free = 0; x.stay = false; items.splice(op.to, 0, x); }
  } else if (op.kind === "add") {
    const r = RIDES[op.key]; if (!r || !(op.to >= 0 && op.to <= items.length)) return null;
    const x = newItem(r.src === "ticket" ? "ticket" : r.src === "show" ? "show" : "ride", op.key, { at: r.src === "show" ? showTime(op.key) - r.early : epOf(op.key)?.at ?? null, free: 0 });
    hold(items); items.splice(x.at != null ? items.filter(it => it.at < x.at).length : op.to, 0, x);  // ショー・時間指定のエクスプレス・パスはその時刻の順に入る（op.to は使わない）
  } else if (op.kind === "freeMove") {
    const f = items[i].free, to = items[op.to]; if (!f || !(op.to >= 0 && op.to <= items.length) || (to && (manualAnchor(to) || to.stay))) return null;
    items[i].free = 0; if (items[op.to]) items[op.to].free += f;
    hold(items.slice(op.to > i ? op.to + 1 : i + 1));
  } else if (op.kind === "free") {
    if (!Number.isFinite(op.free) || manualAnchor(items[i])) return null;
    items[i].free = Math.max(0, Math.round(op.free)); items[i].stay = false; hold(items.slice(i + 1));
  } else return null;
  const next = { ...plan, items };
  manualPack(next, items, keep); items.forEach(it => delete it.stay);
  if (op.kind !== "remove" && manualRows(next).some((r, j) => r.it !== items[j])) return null;
  return next;
}
// 動かす前と後（manualRows）の差: 待ち・歩きの合計の増減、最後の終わりの遅れ、新しく増えた注意。注意が増えたら赤
const manualIssueKey = (r, t) => r.it.id + "|" + t.replace(/[0-9:]+/g, "#");
function manualMoveCost(before, after) {
  const W = rows => rows.reduce((s, r) => s + (r.w ? r.w.med : 0), 0), K = rows => rows.reduce((s, r) => s + r.walk, 0), E = rows => (rows.length ? Math.max(...rows.map(r => r.end)) : null);
  const had = new Set(before.flatMap(r => r.issues.map(t => manualIssueKey(r, t))));
  const issues = after.flatMap(r => r.issues.filter(t => !had.has(manualIssueKey(r, t))).map(t => ({ id: r.it.id, name: RIDES[r.it.key] ? RIDES[r.it.key].short : r.it.title || "休憩", text: t })));
  const wait = Math.round(W(after) - W(before)), walk = K(after) - K(before), endB = E(before), endA = E(after), late = endB == null || endA == null ? 0 : Math.max(0, endA - endB);
  const c = { wait, walk, total: wait + walk, endB, endA, late, cost: Math.max(wait + walk, late), issues };
  c.color = manualCostColor(c); return c;
}
const manualCostColor = c => (c.issues.length ? "red" : c.cost <= MOVE_COST.green ? "green" : c.cost <= MOVE_COST.yellow ? "yellow" : "red");
// 損として見せる数（分）: 終わりの遅れが待ち・歩きの増減より大きければ遅れ、そうでなければ増減（短くなれば負）
const manualLoss = c => (c.loss != null ? c.loss : c.late > 0 && c.late > c.total ? c.late : c.total);
// 境目ごとに実際に動かして計算する（選んだとき1回だけ）。base: {kind:"move",id} / {kind:"add",key} / {kind:"freeMove",id}。今の位置は same、入れられない境目は blocked
//  ショー・時間指定のエクスプレス・パスを足すときは、その時刻の境目1つだけ（fixed）。自由時間を最後へ動かすと消える（drop）
function manualMoveOptions(plan, base) {
  const before = manualRows(plan), self = base.id ? before.findIndex(r => r.it.id === base.id) : -1, n = before.length - (base.kind === "move" ? 1 : 0), out = [];
  const R = base.kind === "add" && RIDES[base.key], fixed = R && (R.src === "show" || epOf(base.key)?.at != null);
  for (let b = 0; b <= n; b++) {
    if (b === self && base.kind !== "add") { out.push({ b, same: true }); continue; }
    const after = manualApply(plan, { ...base, to: b }); if (!after) { out.push({ b, blocked: true }); if (fixed) break; continue; }
    const rows = manualRows(after), o = { b, op: { ...base, to: b }, plan: after, rows, cost: manualMoveCost(before, rows) };
    const me = base.kind === "freeMove" ? null : base.id ? rows.find(r => r.it.id === base.id) : rows.find(r => !before.some(x => x.it.id === r.it.id)); o.me = me ? { start: me.start, arrive: me.arrive, wait: me.w ? Math.round(me.w.med) : 0, end: me.end } : null;  // 動かす予定がその境目だと、いつ並び始めてどれだけ待つか
    if (fixed) { o.b = o.op.to = rows.findIndex(r => !before.some(x => x.it.id === r.it.id)); o.fixed = true; out.length = 0; out.push(o); break; }
    if (base.kind === "freeMove" && b === n) o.drop = true;
    out.push(o);
  }
  // 足すときは待ちが必ず増えるので、一番よい境目との差で色を付ける
  if (base.kind === "add") { const real = out.filter(o => o.cost), lo = Math.min(...real.map(o => o.cost.cost)); real.forEach(o => { o.cost.rel = o.cost.cost - lo; o.cost.color = manualCostColor({ ...o.cost, cost: o.cost.rel }); }); }
  return out;
}
function manualContext(plan, at = plan.cursor) {
  const before = manualRows(plan).filter(r => r.start < at);
  return {loc:before.at(-1)?.to || GATE,ready:Math.max(M.open,plan.entry,...before.map(r => r.end))};
}
function manualChoice(plan, k, cursor = plan.cursor, mode = plan.mode) {
  if (!RIDES[k] || !manualClock(cursor)) return null;
  const r = RIDES[k], context = manualContext(plan,cursor), ready = context.ready;
  const walk = walkMin(context.loc, locOfRide(k));
  const at = mode === "time" ? cursor - (r.src === "show" ? r.early : 0) : r.src === "show" ? showTime(k) - r.early : Math.max(cursor, ready) + walk;
  const start = mode === "next" && r.src !== "show" ? Math.max(at, openAt(k), epOf(k)?.at ?? 0) : at;
  if (!manualClock(start)) return null;
  const it = {id:"manual-preview",type:r.src === "ticket" ? "ticket" : r.src === "show" ? "show" : "ride",key:k,at:start};
  const all = manualRows({...plan,items:[...plan.items,it]}), row = all.find(x => x.it === it), next = all[all.indexOf(row)+1];
  const issues = row.issues.slice();
  if (next && next.arrive > next.start) issues.push(`次の「${RIDES[next.it.key] ? RIDES[next.it.key].short : next.it.title || "休憩"}」に${Math.ceil(next.arrive-next.start)}分足りません`);
  const last = r.src === "show" || epOf(k)?.at != null ? M.close : lastAt(k), first = r.src === "show" ? M.open : openAt(k);
  const canPlace = avail(k,M.date) && start >= first && start <= last && row.end <= M.close && (row.w || ["ticket","show"].includes(r.src));
  return {...row,cursor,mode,issues,canPlace:!!canPlace};
}
const manualPeriod = t => t < 720 ? "午前" : t < 1020 ? "昼・夕方" : "夜";
function manualDayOptions(plan, k) {
  if (!RIDES[k] || !M.prof[k] || ["show","ticket"].includes(RIDES[k].src)) return [];
  // ponytail: 30分刻みの比較。実際に置ける時刻だけを使い、分単位の最適時刻とは呼ばない。
  const first = manualChoice(plan,k,plan.entry,"next"), times = new Set([first?.start,epOf(k)?.at]);
  for (let t = Math.ceil(Math.max(plan.entry,openAt(k))/30)*30; t < M.close; t += 30) times.add(t);
  return [...times].filter(manualClock).map(t => manualChoice(plan,k,t,"time")).filter(c => c?.w && c.canPlace && !c.issues.length).sort((a,b) => a.start-b.start);
}
function manualAssess(plan, k) {
  const c = manualChoice(plan,k); if (!c) return null;
  // 朝一の仮定（先頭付近で0分など）は1日の比較の基準にしない。比べるのは通常の予測（cw）。
  const day = manualDayOptions(plan,k).filter(x => !x.opening), byWait = xs => xs.slice().sort((a,b) => a.w.med-b.w.med || a.start-b.start)[0], cw = c.opening ? c.normalW : c.w;
  const best = byWait(day), future = byWait(day.filter(x => x.start >= c.start+60));
  const saving = c.w && future ? c.w.med-future.w.med : 0, delayed = c.start >= plan.cursor+90;  // 夜に回すかは、カードに出す待ち（朝一の想定なら0分）で決める
  const hold = delayed || saving >= 15, later = delayed ? byWait(day.filter(x => x.start >= c.start)) : saving >= 15 ? future : null;
  const mids = day.filter(x => x.start >= Math.max(660,c.start) && x.start < 1020).map(x => x.w.med).sort((a,b) => a-b), mid = mids.length ? mids[mids.length>>1] : null, gain = cw && mid != null ? mid-cw.med : 0;  // これから昼になると増える分（17時を過ぎたら0）
  const rest = day.filter(x => x.start >= c.start).map(x => x.w.med), lo = Math.min(...rest), hi = Math.max(...rest);  // このあとの待ちの幅
  const regret = cw && best ? Math.max(0,cw.med-best.w.med) : 0, morningGain = c.start < 660 && gain >= 15, same = !epOf(k) && rest.length > 1 && hi-lo < 15 && regret <= 10;
  const benefit = [];
  if (later && cw && cw.med-later.w.med >= 10) benefit.push(`${manualPeriod(later.start)}の${hm(later.start)}なら約${Math.round(later.w.med)}分。${hm(c.start)}に並ぶより約${Math.round(cw.med-later.w.med)}分、列を減らせる予測です。`);
  else if (delayed) benefit.push(epOf(k)?.at != null ? `エクスプレス・パスの指定は${hm(epOf(k).at)}です。この時刻を先に入れて、ほかの候補を相談できます。` : openAt(k) > plan.cursor ? `${hm(openAt(k))}から運営する候補です。先に別の乗り物を選んで、ここは後の時間に置けます。` : `${hm(c.start)}から並べる案です。この時刻を先に入れて、ほかの候補を相談できます。`);
  else if (cw && morningGain) benefit.push(`${hm(c.start)}なら約${Math.round(cw.med)}分、昼（11〜17時）は約${Math.round(mid)}分の予測。今のうちが得です。`);
  else if (cw && future && future.w.med-cw.med >= 10) benefit.push(`1時間以上あとでは、短めの候補でも約${Math.round(future.w.med)}分。今なら約${Math.round(future.w.med-cw.med)}分、列を減らせる予測です。`);
  else if (cw && best && same) benefit.push(`このあといつ乗っても約${Math.round(lo)}〜${Math.round(hi)}分。${c.start < 660 ? "朝は、昼に混む乗り物に使うのも手です。" : ""}`);
  else if (cw && best && cw.med-best.w.med <= 10) benefit.push(cw.med-best.w.med <= 5 ? "この日の短めの時間帯に入っています。あとまで待っても列の差は小さく、今選びやすい候補です。" : `この日の短めの時間と比べても、差は約${Math.round(cw.med-best.w.med)}分。今選びやすい候補です。`);
  else if (cw) benefit.push(`ここでは約${Math.round(cw.med)}分の列で、${hm(c.end)}ごろに終わる予測です。朝・昼・夜も比べられます。`);
  if (c.walk <= 5) benefit.push(`直前の場所から歩いて${c.walk}分。近くをまとめて回れます。`);
  if (RIDES[k].grp === "nintendo") benefit.push("エリア入場の整理券・入場時間も確認してください。");
  if (c.opening) benefit.unshift(`開園前から待って先頭付近に入れる場合の想定です。通常入園の予測は約${Math.round(c.normalW.med)}分です。`);
  return {...c,day,best,future,later,hold,benefit,score:(c.w?.med || 0)+c.walk+regret*1.5-Math.max(0,gain),why:hold ? `${manualPeriod((later || c).start)}に回す案` : cw && morningGain ? `昼は約${Math.round(mid)}分。今が得` : future && cw && future.w.med-cw.med >= 10 ? "今のうちに乗るメリットあり" : best && cw && same ? "いつ乗っても同じくらい" : best && cw && cw.med-best.w.med <= 10 ? "1日の中でも列が短め" : "待ちと移動で選ぶ候補"};
}
function manualCandidates(plan) {
  const used = new Set(plan.items.map(x => x.key)), open = keys => keys.filter(k => RIDES[k] && avail(k,M.date) && M.prof[k] && !used.has(k)), rank = keys => keys.map(k => manualAssess(plan,k)).filter(x => x && x.canPlace && !x.issues.length).sort((a,b) => Number(a.hold)-Number(b.hold) || a.score-b.score);
  const want = plan.want || plan.wish || [], left = open(want), unplaced = want.filter(k => RIDES[k] && avail(k,M.date) && !used.has(k));
  // 乗りたいもの（ショー・整理券も含む）が全部予定に入ったときだけ、運営中の乗り物から同じ評価で見せる（予定には入れない）。
  return unplaced.length || !want.some(k => used.has(k)) ? rank(left) : Object.assign(rank(open(Object.keys(RIDES))),{fallback:true});
}
function manualSuggestions(plan, pool = manualCandidates(plan), skip = "") {
  const picked = [];
  if (RIDES[plan.focus]) { const c = pool.find(x => x.it.key === plan.focus) || manualAssess(plan,plan.focus); if(c) picked.push({...c,why:"気になっている乗り物 · "+c.why}); }
  for (const c of pool) if (!picked.some(p => p.it.key === c.it.key)) picked.push(c);
  return picked.filter(c => c.it.key !== skip).slice(0,3);  // 選択中の1件を外しても3件にする
}
function manualPlace(plan, choice, keepCursor = false) {
  if (!choice || !choice.canPlace || !manualClock(choice.start)) return false;
  plan.items.push(newItem(choice.it.type,choice.it.key,{at:choice.start}));
  plan.items.sort((a,b) => a.at-b.at);
  if (!keepCursor) { plan.cursor = Math.min(1439,choice.end); plan.mode = "next"; }
  return true;
}
function manualAt(plan, key, at, id = null) {
  if (!manualClock(at) || at < plan.entry) return null;
  const existing = id && plan.items.find(x => x.id === id); if (id && !existing) return null;
  const base = {...plan,items:plan.items.filter(x => x.id !== id)}, k = existing?.key || key;
  if (RIDES[k]) return manualChoice(base,k,at+(RIDES[k].src === "show" ? RIDES[k].early : 0),"time");
  if (!existing) return null;
  const item = {...existing,at}, rows = manualRows({...base,items:[...base.items,item]}), c = rows.find(r => r.it === item), next = rows[rows.indexOf(c)+1];
  if (next && next.arrive > next.start) c.issues.push(`次の予定に${Math.ceil(next.arrive-next.start)}分足りません`);
  return {...c,canPlace:c.end <= M.close};
}
// 写真・グラフは見るだけ。選び直すたびに元の時刻へ戻し、新しい乗り物はそこから歩いて並べる最初の時刻で開く。
function manualArmState(plan, payload) {
  const base = plan.compareFrom || {cursor:plan.cursor,mode:plan.mode}; plan.cursor = base.cursor; plan.mode = base.mode;
  const existing = plan.items.find(x => x.id === payload.id), next = !existing && base.mode === "next" && manualChoice(plan,payload.key,base.cursor,"next");  // 「時刻を決めて置く」なら指定の時刻のまま
  // ショーは開演が決まっているので、元の時刻より前の回なら時刻を動かさない。置けない時刻（閉園間際など）でも動かさない。
  if (existing) plan.cursor = existing.at; else if (next?.canPlace && (RIDES[payload.key].src !== "show" || next.start+RIDES[payload.key].early >= base.cursor)) plan.cursor = next.start;
  plan.compareFrom = base; plan.mode = "time"; plan.placing = payload; plan.focus = !payload.id && RIDES[payload.key] ? payload.key : "";
  return plan;
}
function manualCloseState(plan) {
  delete plan.placing; plan.focus = "";
  if (plan.compareFrom) { Object.assign(plan,plan.compareFrom); delete plan.compareFrom; }
  return plan;
}
function manualCommitAt(plan, key, at, id = null) {
  const c = manualAt(plan,key,at,id); if (!c?.canPlace) return null;
  if (id) plan.items.find(x => x.id === id).at = c.start;
  else if (!manualPlace(plan,c,true)) return null;
  plan.items.sort((a,b) => a.at-b.at); return c;
}
// 考える時刻は、from から続く予定の終わり（最初の空き）。夜に置いた予定へは飛ばない。
function manualFreeFrom(plan, from = plan.entry) {
  let t = Math.max(from, plan.entry);
  for (const r of manualRows(plan)) { if (r.end <= t) continue; if (r.start <= t + 30) t = r.end; else break; }
  return Math.min(1439, t);
}
// 考える時刻 t のすぐ後にいま置いた予定 next がある。間が短く（90分未満）、そこで始められる希望がなければ next の終わりへ進む（空きは自由時間のまま）。
// 希望外の乗り物（fallback）や夜に回す案は「入る候補」に数えない。カードに見せるだけで、考える時刻は決めない。
function manualSkipGap(plan, t, next) {
  if (!next || !(next.start > t && next.start - t < 90) || !(plan.want || plan.wish || []).length) return t;
  const pool = manualCandidates({...plan,cursor:t,mode:"next",focus:""});
  return !pool.fallback && pool.some(x => x.start < next.start) ? t : manualFreeFrom(plan,next.end);
}
// 置いた・動かしたあとの考える時刻。動かした予定が空けた時間にも戻る。
function manualCursorAfter(before, plan, c, id = null) {
  const from = before.compareFrom?.cursor ?? before.cursor, old = id ? before.items.find(x => x.id === id)?.at : null;
  const t = manualFreeFrom(plan, old != null ? Math.min(from, manualContext(plan,old).ready) : from), next = manualRows(plan).find(r => r.end > t);
  return next?.start === c.start ? manualSkipGap(plan,t,next) : t;
}
// 組み合わせの相手は、写真で最近選んだ乗り物、写真やチェックで足した（既定の候補にない）乗り物を先に見る。
const manualMates = plan => { const w = plan.want || [], wish = plan.wish || []; return [...(plan.picked || []).filter(k => w.includes(k)),...w.filter(k => !wish.includes(k)),...w]; };
// 比べる相手：other を渡せばそれ（null は比べない）、なければまだ予定にない希望の最初。予定に入っている・予約の乗り物は相手にしない（置いた予定を黙って動かさない）。
const manualMate = (plan,k,other) => (other === undefined ? manualMates(plan) : [other]).find(key => key !== k && !plan.items.some(x => x.key === key) && M.prof[key] && ["r","h","est"].includes(RIDES[key]?.src) && epOf(key)?.at == null);
function manualResolve(plan,k,includeWish = true,mate) {
  if (mate === null || !M.prof[k] || plan.items.some(x => x.key === k) || !["r","h","est"].includes(RIDES[k]?.src)) return [];
  const base = JSON.stringify(plan.items), byWait = xs => xs.slice().sort((a,b) => a.w.med-b.w.med || a.start-b.start);
  const solo = byWait(manualDayOptions({...plan,items:[]},k)).slice(0,6);
  const movable = plan.items.filter(x => ["r","h","est"].includes(RIDES[x.key]?.src) && x.pin == null && !x.lock && epOf(x.key)?.at == null);
  // 相手を選んだときは、その相手と比べる（置いた予定は固定したまま）。
  if ((!movable.length || mate) && includeWish) {
    const other = manualMate(plan,k,mate);
    const first = other && byWait(manualDayOptions(plan,other))[0]; if (!first) return [];
    const phantom = {...first.it,id:"manual-want-preview"};
    return manualResolve({...plan,items:[...plan.items.map(x => ({...x,lock:true})),phantom]},k,false).map(option => {
      const change = option.changes.find(x => x.id === phantom.id), additions = option.changes.filter(x => x.id !== phantom.id);
      const changes = [{key:other,at:change?.at ?? phantom.at},...additions], items = [...plan.items,...changes.map((c,i) => ({id:"wish-option-"+i,type:"ride",key:c.key,at:c.at}))];
      const rows = manualRows({...plan,items}).filter(r => changes.some(c => c.key === r.it.key));
      return {...option,base,changes,rows,title:rows.map(r => `${RIDES[r.it.key].short}（${hm(r.start)}）`).join(" → ")+"を、空きやすい時間に"};
    });
  }
  const options = [], rows = manualRows(plan);
  const add = (changes,title) => {
    const items = plan.items.map(x => ({...x}));
    changes.forEach((change,i) => { if (change.id) items.find(x => x.id === change.id).at = change.at; else items.push({id:"option-new-"+i,type:"ride",key:change.key,at:change.at}); });
    const result = manualRows({...plan,items}); if (result.some(r => r.issues.length)) return;
    options.push({base,changes,title,rows:result.filter(r => changes.some(c => c.id ? c.id === r.it.id : c.key === r.it.key)),wait:result.reduce((s,r) => s+(r.w?.med || 0),0),walk:result.reduce((s,r) => s+r.walk,0)});
  };
  // ponytail: ぶつかる1件を動かす2案。予約・ショーや、関係のない予定は動かさない。
  let shifted = false;
  for (const target of solo) {
    const conflict = movable.find(it => { const r = rows.find(x => x.it.id === it.id); return r.start < target.end+walkMin(target.to,r.to) && r.end+walkMin(r.to,target.to) > target.start; });
    if (!conflict) continue;
    const without = {...plan,items:plan.items.filter(x => x.id !== conflict.id)}, b = manualChoice(without,k,target.start,"time");
    if (!b?.canPlace || b.issues.length) continue;
    const alternatives = byWait(manualDayOptions({...without,items:[...without.items,b.it]},conflict.key)).filter(a => Math.abs(a.start-conflict.at) >= 15).slice(0,2);
    for (const a of alternatives) { const n = options.length; add([{id:conflict.id,key:conflict.key,at:a.start},{key:k,at:b.start}],`${RIDES[conflict.key].short}を動かして、${RIDES[k].short}を入れる`); if (options.length > n) shifted = true; }
  }
  if (!shifted) return [];
  const keep = byWait(manualDayOptions(plan,k))[0];
  if (keep) add([{key:k,at:keep.start}],"先の予定を残して、もう一つを入れる");
  const unique = [...new Map(options.map(o => [JSON.stringify(o.changes),o])).values()].sort((a,b) => a.wait+a.walk-b.wait-b.walk);
  const fixed = unique.find(o => o.changes.length === 1), moved = unique.find(o => o.changes.length === 2);
  return [fixed,moved].filter(Boolean).sort((a,b) => a.wait+a.walk-b.wait-b.walk);
}
function manualApplyOption(plan,option) {
  if (!option || JSON.stringify(plan.items) !== option.base) return false;
  const items = plan.items.map(x => ({...x})), changed = [], from = plan.compareFrom?.cursor ?? plan.cursor;
  for (const c of option.changes) {
    if (!manualClock(c.at)) return false;
    const it = c.id ? items.find(x => x.id === c.id) : newItem("ride",c.key,{at:c.at}); if (!it) return false;
    it.at = c.at; if (!c.id) items.push(it); changed.push(it.id);
  }
  const rows = manualRows({...plan,items}); if (rows.some(r => r.issues.length)) return false;
  // 考える時刻は、比べ始めた時刻から続く予定の終わり（最初の空き）。入れた予定の前の短い空きに入る希望がなければ、その先へ。
  plan.items = items.sort((a,b) => a.at-b.at); const t = manualFreeFrom(plan,from), next = manualRows(plan).find(r => r.end > t);
  plan.cursor = changed.includes(next?.it.id) ? manualSkipGap(plan,t,next) : t; plan.mode = "next"; plan.focus = "";
  delete plan.placing; delete plan.compareFrom; return true;
}
function manualOpeningOrders(plan,k,mate) {
  const other = manualMate(plan,k,mate);
  if (!other || !M.prof[k] || plan.entry > M.open+15 || plan.cursor >= M.open+90 || epOf(k)?.at != null) return [];
  const keys = [k,other], existing = plan.items.filter(x => x.key === k);
  if (existing.some(x => x.pin != null || x.lock) || !["r","h","est"].includes(RIDES[k]?.src)) return [];
  const base = {...plan,items:plan.items.filter(x => !keys.includes(x.key))}, options = [];
  for (const order of [[k,other],[other,k]]) {
    const first = manualChoice(base,order[0],plan.entry,"next"); if (!first?.canPlace || first.issues.length || first.start >= Math.min(720,M.open+60)) continue;
    const nextPlan = {...base,items:[...base.items,first.it]}, second = manualChoice(nextPlan,order[1],first.end,"next"); if (!second?.canPlace || second.issues.length || second.start >= 720 || second.start >= second.arrive+30) continue;  // 着いてもまだ運営していない相手は朝の順番にしない
    const rows = manualRows({...base,items:[...nextPlan.items,second.it]}); if (rows.some(r => r.issues.length)) continue;
    const pair = rows.filter(r => keys.includes(r.it.key)), end = Math.max(...pair.map(r => r.end));
    options.push({base:JSON.stringify(plan.items),category:"opening",title:order.map(key => RIDES[key].short).join(" → ")+"の順で回る",changes:pair.map(r => ({id:existing.find(x => x.key === r.it.key)?.id,key:r.it.key,at:r.start})),rows:pair,
      wait:rows.reduce((s,r) => s+(r.w?.med || 0),0),walk:rows.reduce((s,r) => s+r.walk,0),pairWait:pair.reduce((s,r) => s+(r.w?.med || 0),0),pairWalk:pair.reduce((s,r) => s+r.walk,0),pairEnd:end,secondArrive:second.arrive});
  }
  return options.sort((a,b) => a.pairEnd-b.pairEnd || a.pairWait+a.pairWalk-b.pairWait-b.pairWalk);
}
function manualStop(plan, title, dur, loc = null) {
  if (!Number.isFinite(dur) || dur < 5 || dur > 240 || !manualClock(plan.cursor)) return false;
  const context = manualContext(plan), to = loc || context.loc;
  const at = plan.mode === "next" ? Math.max(plan.cursor,context.ready) + walkMin(context.loc,to) : plan.cursor;
  if (at + dur > M.close) return false;
  plan.items.push(newItem("rest",null,{title:String(title).slice(0,80),dur,at,loc:to}));
  plan.items.sort((a,b) => a.at-b.at); plan.cursor = at + dur; plan.mode = "next";
  return true;
}
function manualFood(plan, key) {
  const food = FOOD.items[key]; if (!food) return false;
  const ctx = manualContext(plan), depart = plan.mode === "time" ? plan.cursor : Math.max(plan.cursor,ctx.ready);
  const store = bestStore(key,ctx.loc,depart); if (!store) return false;
  const at = plan.mode === "time" ? plan.cursor : depart + walkMin(ctx.loc,store.loc), type = FOOD.stores[store.sk].type;
  return manualStop(plan,food.name,storeQueue(store.sk,at) + (type === "rest" ? 40 : STORE_USE[type]+5),store.loc);
}
function manualText(plan) {
  const lines = [`ユニバ ${md(M.date)}・自分たちで決めた予定`,`入園 ${hm(plan.entry)}`];
  for (const r of manualRows(plan)) {
    const ride = RIDES[r.it.key], label = ride ? ride.short : r.it.title || "休憩";
    lines.push(`${hm(r.start)} ${label}${r.w ? `（待ち約${Math.round(r.w.med)}分${r.opening ? "・朝一の先頭付近という想定" : ""}）` : ride && ride.src === "ticket" ? "（整理券の回は要確認）" : ride && ride.src === "show" ? `（開演${hm(r.start+ride.early)}・時刻は要確認）` : ride ? "（待ち予測なし）" : `（${r.d}分）`} → ${hm(r.end)}ごろ${r.issues.length ? " ※"+r.issues.join("・") : ""}`);
  }
  lines.push("待ち時間・移動・終わりは予測です。空き時間は自由に過ごせます。");
  return lines.join("\n");
}
// 「この予定で当日を使う」: 相談メモ（P().manual）を当日の予定（P().items）に写す。見せてから採用し、置き換える前の予定を1世代だけ残す。写したあとは独立（メモを変えても当日は変わらない）
// 時刻と順番はそのまま（at。ショー・整理券・ロックは pin で固定。時刻のあるEPはEPの時刻で固定し、メモの時刻とずれれば遅れの警告が出る）、mAt に予定の時刻を残す。描画・自動の読み込みでは組み直さない（組み直すのは押したときだけ）
// 見せる数字は、採用後に出る数字と同じ始め方で計算する（o: 当日なら当日タブの今・今いる所、それ以外は {}＝計画タブと同じ既定の入園）。from に何時・どこから計算したかを返す
const liveBusy = () => (P().items || []).some(x => P().done[x.id] || x.qs != null);  // 済んだ印か並び中がある＝当日が進んでいる
const manualForLive = plan => plan.items.slice().sort((a, b) => a.at - b.at).map(x => { const { id, ...r } = JSON.parse(JSON.stringify(x)), R = RIDES[r.key], ea = R ? epOf(r.key)?.at : null, fix = r.lock || (R && (R.src === "show" || R.src === "ticket")); return newItem(r.type, r.key, { ...r, pin: ea ?? (fix ? r.at : null), mAt: r.at }); });
function previewManualForLive(o = {}) {
  const plan = P().manual;
  if (!plan || !plan.items.length) return { ok: false, why: "自分たちの予定がまだありません。" };
  if (liveBusy()) return { ok: false, why: "当日の予定に済んだ印か並び中があるので、取り込みません（進んだ予定は置き換えません）。" };
  const items = manualForLive(plan), cur = Array.isArray(P().items) ? P().items : [];
  const from = { start: o.start ?? (M.open + (S.entry || 0) + (S.slack ? 15 : 0)), loc: o.loc || GATE };
  const a = simulate(cur, from), b = simulate(items, from);  // sig に見せた数字も入れる（見せたあとに今の待ち・休止が変わって数字が違えば、採用せずに見せ直す）
  return { ok: true, items, cur, from, a, b, sig: JSON.stringify([plan.items, cur, P().ep || {}, from, [a.end, a.waitTot, a.bad, b.end, b.waitTot, b.bad], b.rows.map(r => [Math.round(r.start), r.flag])]) };
}
function adoptManualForLive(sig, o = {}) {
  const p = previewManualForLive(o); if (!p.ok || p.sig !== sig) return p.ok ? { ...p, ok: false, stale: true } : p;
  const pl = P(); pl.adopt = { items: Array.isArray(pl.items) ? pl.items : null, live: pl.live || null }; pl.items = p.items; pl.live = null; save();
  return p;
}
function undoManualForLive() {
  const pl = P(); if (!pl.adopt) return { ok: false, why: "戻せる予定がありません。" };
  if (liveBusy()) return { ok: false, why: "済んだ印か並び中があるので、元に戻しません。" };
  pl.items = pl.adopt.items; pl.live = pl.adopt.live; delete pl.adopt; save(); return { ok: true };
}
// 谷の確からしさ: 似た日のうち、その時間帯がその日一番空いていた2時間に入っていた割合（開園直後・閉園前の谷は安定、昼の谷はぶれやすい）
function troughShare(k, h) {
  const r = RIDES[k], src = r.from_ || k, sh = M.open - 480, out = [];
  for (const x of M.crowd.refs) {
    const hv = {};
    if (r.src === "r") { const s = x.s[src]; if (!s) continue; for (let i = 0; i < SLOT_M.length; i++) { const v = dec(s, i); if (v == null) continue; const hh = Math.floor((SLOT_M[i] < 720 ? SLOT_M[i] + sh : SLOT_M[i]) / 60); (hv[hh] = hv[hh] || []).push(v); } }
    else if (r.src === "h") { const s = x.h[k]; if (!s) continue; for (let i = 0; i < 14; i++) { const v = dec(s, i); if (v != null) hv[8 + i] = [v]; } }
    const hs = Object.entries(hv).map(([hh, v]) => [+hh, v.reduce((a, b) => a + b, 0) / v.length]).sort((a, b) => a[1] - b[1]);
    if (hs.length >= 4) out.push(hs.slice(0, 2).some(q => q[0] === h));
  }
  return out.length >= 3 ? out.filter(Boolean).length / out.length : null;
}
// ================= 去年の実際の日に当てはめる =================
// WAIT_SCALE: 答え合わせで「去年より1割混んだら」を試すとき、実際の待ちを一律に何倍かする（シー版と同じ）
let WAIT_SCALE = 1;
function dayWait(k, x, t, ag = false) {
  let w = dayWait0(k, x, t);
  if (WAIT_SCALE !== 1 && w && !w.closed && w.w != null) w = { ...w, w: w.w * WAIT_SCALE };
  return epOf(k) && !ag && !(w && w.closed) ? { w: EPW } : w;
}
// 予定の点数（シー版と同じ考え方）: 似た日（1日ずつ抜いて作り直した予定）で、ふつう×50＋1割混む×30＋厳しめ×20。looRun の結果から
const scoreOfLoo = (loo, keys) => { const N = loo.length, c = key => loo.filter(l => l[key] && l.order && keys.every(k => l.order.some(o => o.key === k) && !l[key].missed.some(m => m.k === k))).length;
  return N ? { sc: Math.round(100 * (0.5 * c("same") + 0.3 * c("s11") + 0.2 * c("harsh")) / N), ok: c("same"), ok11: c("s11"), okH: c("harsh"), N } : null; };
const replay11 = (sm, x) => { WAIT_SCALE = 1.1; try { return replayLive(sm, x, "same"); } finally { WAIT_SCALE = 1; } };
function dayWait0(k, x, t) {
  const r = RIDES[k], src = r.from_ || k;
  if (r.src === "h") {
    const s = x.h[k]; if (!s) return null;
    const pts = []; for (let i = 0; i < 14; i++) { const v = dec(s, i); if (v != null) pts.push([(8 + i) * 60 + 30, v]); }
    return openLater(interp(pts, t, false), pts, x, t);
  }
  if (r.src !== "r" || (r.from_ && !fromDay(x.d))) return null;
  const s = x.s[src]; if (!s) return null;
  const sh = M.open - 480, pts = [];
  // 別の日の記録は、予測と同じく行く日の条件（連休の種類・営業時間・今年の水準）に直して使う。その日自身（答え合わせ）はそのまま
  const f = x.d === M.date ? 1 : relF(M.date, x) * (r.from_ || !lastYr(M.date, x) ? 1 : yoyRide(src)) * wxF(M.date, x, src) * seasF(src, M.date, x);
  for (let i = 0; i < SLOT_M.length; i++) { const v = dec(s, i); if (v != null) { const m = SLOT_M[i] < 720 ? SLOT_M[i] + sh : SLOT_M[i]; if (!r.open || m >= r.open - 30) pts.push([m, v * f]); } }
  const cutM = (r.cut_in || []).filter(([rg]) => inR(M.date, [rg])).map(z => z[1])[0];
  const P2 = cutM ? pts.filter(p => p[0] <= cutM) : pts;
  return openLater(interp(P2, t, !r.open), P2, x, t);
}
// 似た日が行く日より早く閉園して閉まっていただけなら、行く日は開いているので、最後の値で続ける（その日の早い閉園を「乗れなかった」と数えない）
function openLater(res, pts, x, t) {
  if (res && res.closed && x.d !== M.date && x.c && x.c < M.close - 10 && res.last >= x.c - 70 && t <= M.close - 15) return { w: pts[pts.length - 1][1] };
  return res;
}
// 当日の人と同じように回す: 整理券などに間に合わせるため乗り物を飛ばしたら、ほかの予定の順番はそのままに、
//  飛ばした乗り物を残りの予定のどこかに入れ直す（予測で試して、ほかが間に合わなくならず、終わりが一番早い所。うしろの予定はその分ずれる）。1日4回まで
//  途中で全部を組み直すと、夜の空く時間まで待つ並べ方になって閉園前に詰まりやすく、1年の試算ではかえって悪かったので、入れ直すだけにしている
function replayLive(sim, x, mode = "same") {
  const out = { d: x.d, end: 0, tot: 0, late: 0, missed: [], unknown: [], rides: 0, subs: [], notes: [], planned: sim.rows.filter(r => RIDES[r.it.key]).length };
  let cur = sim;
  for (let n = 0; ; n++) {
    const r = replay(cur, x, mode, { stop: n < 4, hurry: n > 0 });
    out.tot += r.tot; out.rides += r.rides; out.late = Math.max(out.late, r.late); out.end = r.end;
    out.missed.push(...r.missed); out.unknown.push(...r.unknown); out.subs.push(...r.subs); out.notes.push(...r.notes);
    if (!r.stop) break;
    const { t, loc } = r.stop, [sk, ...base] = r.stop.rest.map(i => ({ ...i, at: undefined }));
    const s0 = simulate(base, { start: t, loc }); let best = null;
    for (let i = 0; i <= base.length; i++) {
      const ord = [...base.slice(0, i), sk, ...base.slice(i)], s2 = simulate(ord, { start: t, loc }), row = s2.rows.find(q => q.it.id === sk.id);
      if (row && !row.flag && s2.bad <= s0.bad && (!best || s2.end < best.end)) best = { ord, end: s2.end, at: row.start };
    }
    const ord = best ? best.ord : [...base, sk];
    out.notes.push(`${RIDES[sk.key] ? RIDES[sk.key].short : itemName(sk)}は${best ? `${hm(best.at)}ごろに入れ直した` : "最後に回した"}`);
    cur = simulate(ord, { start: t, loc });
  }
  return out;
}
function interp(pts, t, ramp) {
  if (!pts.length) return null;
  const L = pts[pts.length - 1];
  if (t > L[0] + 10) return { closed: true, last: L[0] };
  // その日の最初の記録より前（開園直後）は、開園時に最初の値の6割から伸びるとみる。記録では開園15分後が45分後の約0.75倍（開園15分後÷105分後 0.50、45分後÷105分後 0.67。2025/9〜2026/10）。
  //  前は開園時0分から伸ばしていて、似た日で回す見込みが朝を短く見ていた（答え合わせでも、開園直後は予測が長すぎるように見えていた）
  if (t <= pts[0][0]) return { w: ramp ? pts[0][1] * (0.6 + 0.4 * Math.min(1, Math.max(t - M.open, 0) / Math.max(1, pts[0][0] - M.open))) : pts[0][1] };
  for (let i = 0; i < pts.length - 1; i++) if (pts[i][0] <= t && t <= pts[i + 1][0]) return { w: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * (t - pts[i][0]) / (pts[i + 1][0] - pts[i][0]) };
  return { w: L[1] };
}
// 検証: 予定の順番で、その日の実際の待ち時間で回す。ただし当日の人と同じように動く
//  ・整理券やショーの時刻に間に合わなくなる乗り物は、並ばずに飛ばす
//  ・整理券に遅れそうなごはん・食べ歩きは、整理券のあとに回す
//  ・飛ばした・受付が終わっていたで時間が空いたら、その場で（公式アプリで今の待ちを見て）予定にない乗り物のうち待ちの一番短いものに乗る。
//    ただし、そのあとの予定を遅らせない（予定していた時間の中で・次の整理券に間に合う）ものだけ
//  ・乗れなかった・飛ばしたものには理由（どこで何分遅れたか）を残す
//  mode "same"  … 計画と同じ前提（歩く速さ・行列の見込み・入園時刻）で、待ち時間だけその日の実際の値
//  mode "harsh" … さらに歩く1.4倍＋3分・行列1.5倍・入園15分遅れ（厳しめ）
//  乗れなかった理由: late＝遅れて締め切りを過ぎた／early＝その日だけ早く受付終了（故障・天候など）／ticket＝整理券・ショーに遅れた／skip＝整理券に間に合わせるため飛ばした
function replay(sim, x, mode = "same", opt = {}) {
  const harsh = mode === "harsh";
  let t = (sim.rows.length ? sim.rows[0].arrive - sim.rows[0].walk : M.open) + (harsh ? 15 : 0), loc = sim.rows.length ? sim.rows[0].from : GATE, tot = 0, late = 0, worst = null, rides = 0, hurry = !!opt.hurry;
  const missed = [], unknown = [], subs = [], notes = [], deferred = [], retry = [], pend = [], planned = new Set(sim.rows.map(r => r.it.key)), used = new Set();
  const wkOf = (a, b) => (a === b ? 0 : harsh ? Math.round(walkMin(a, b) * 1.4) + 3 : walkPlan(a, b));
  const cause = () => (worst && worst.over >= 10 ? `前の${worst.name}が予定より${Math.round(worst.over)}分長かった` : "前の予定が少しずつ遅れた");
  const isFix = r => RIDES[r.it.key] && (RIDES[r.it.key].src === "ticket" || RIDES[r.it.key].src === "show");
  const grace = r => (RIDES[r.it.key].src === "show" ? RIDES[r.it.key].early : 15);
  const kidsOK = S.sel.some(k => RIDES[k] && RIDES[k].grp === "kids");  // 子ども向けを選んでいる人だけ、代わりにも子ども向けを使う
  const recover = (insteadOf, until, nf) => {
    let best = null;
    for (const k of Object.keys(RIDES)) {
      const R = RIDES[k]; if (R.src !== "r" || R.from_ || planned.has(k) || used.has(k) || !avail(k, M.date) || (R.grp === "kids" && !kidsOK)) continue;
      const to = locOfRide(k), at = t + wkOf(loc, to), w = dayWait(k, x, at); if (!w || w.closed) continue;
      const fin = at + w.w + (R.dur || 5);
      if (fin > until || (nf && fin + wkOf(to, nf.to) > nf.start)) continue;
      if (!best || w.w < best.w) best = { k, w: w.w, fin, to };
    }
    if (!best) return;
    used.add(best.k); subs.push({ k: best.k, insteadOf, w: Math.round(best.w), at: Math.round(t) });
    tot += best.w; t = best.fin; loc = best.to;
  };
  // 飛ばした乗り物（「必ず」以外）は、あとの自由時間に収まるなら乗りに行く（次の予定の時刻 until を遅らせないときだけ）
  const fitPend = (until, toLoc) => {
    for (let i = 0; i < pend.length; i++) {
      const q = pend[i], st = t + wkOf(loc, q.to), w = dayWait(q.it.key, x, st, q.it.again) || { w: upper(waitAt(q.it.key, st)) };
      if (w.closed || st + w.w + q.d + (toLoc ? wkOf(q.to, toLoc) : 0) > until) continue;
      pend.splice(i--, 1); const mi = missed.findIndex(m => m.k === q.it.key && m.kind === "skip"); if (mi >= 0) missed.splice(mi, 1);
      notes.push(`${RIDES[q.it.key].short}は${hm(st)}からの空き時間に乗った（待${Math.round(w.w)}分）`);
      tot += w.w; t = st + w.w + q.d; loc = q.to; rides++;
    }
  };
  // opt.stop: 飛ばす・受付が終わっていた・20分以上遅れた、のときは、そこで止めて残り（rest）を返す（replayLive が組み直す）
  const stopAt = (from, extra = []) => ({ d: x.d, end: t, tot, late, missed, unknown, rides, subs, notes, planned: sim.rows.filter(q => RIDES[q.it.key]).length,
    stop: { t: Math.round(t), loc, rest: [...extra, ...deferred.map(z => z.r.it), ...retry.map(q => q.it), ...pend.map(q => q.it), ...sim.rows.slice(from).map(q => q.it)] } });
  for (let idx = 0; idx < sim.rows.length; idx++) {
    const r = sim.rows[idx];
    if (pend.length) fitPend(r.start, r.to);
    const wk = wkOf(loc, r.to);
    let start = Math.max(t + wk, r.start);
    // ずれ始めたら（飛ばした・15分以上遅れた）、そこから先は空くのを待たずに詰めて回る（当日の人と同じ。予定どおりのうちは空く時間を待つ）
    if (hurry && t + wk < r.start && RIDES[r.it.key] && !isFix(r)) start = t + wk;
    if (start - r.start >= 15) hurry = true;
    late = Math.max(late, Math.round(start - r.start));
    const R = RIDES[r.it.key], nf = sim.rows.slice(idx + 1).find(isFix);
    if (!R) {
      const q = r.wait * (harsh ? 1.5 : 1), extra = q - r.wait + (harsh && r.it.type === "meal" ? 10 : 0), d = r.d + q + (harsh && r.it.type === "meal" ? 10 : 0);
      if (nf && r.it.type !== "wc" && start + d + wkOf(r.to, nf.to) > nf.start + grace(nf)) { deferred.push({ r, d }); notes.push(`${itemName(r.it)}は${RIDES[nf.it.key].short}のあとに回した`); continue; }
      if (extra >= 10 && (!worst || extra > worst.over)) worst = { name: itemName(r.it), over: extra };
      loc = r.to; t = start + d; continue;
    }
    if (isFix(r)) {
      if (start > r.start + grace(r)) { missed.push({ k: r.it.key, ag: r.it.again, kind: "ticket", why: `${hm(r.start)}の${R.src === "show" ? "開演" : "整理券の時刻"}に${Math.round(start - r.start)}分遅れた（${cause()}）` }); t += wk; loc = r.to; continue; }
      loc = r.to; t = start + r.d; rides++;
      while (deferred.length) { const { r: q, d } = deferred.shift(); t += wkOf(loc, q.to) + d; loc = q.to; }
      // 整理券のために飛ばした「必ず」は、整理券のあとに並び直す（次の整理券・ショーに間に合い、受付中なら）
      const nf2 = sim.rows.slice(idx + 1).find(isFix);
      while (retry.length) {
        const q = retry.shift(), st = t + wkOf(loc, q.to), w2 = dayWait(q.it.key, x, st, q.it.again) || { w: upper(waitAt(q.it.key, st)) };  // 記録のない日は多めの見込みで
        if (w2.closed || (nf2 && st + w2.w + q.d + wkOf(q.to, nf2.to) > nf2.start + grace(nf2))) continue;
        const mi = missed.findIndex(m => m.k === q.it.key && m.kind === "skip"); if (mi >= 0) missed.splice(mi, 1);
        notes.push(`${RIDES[q.it.key].short}は${R.short}のあとに乗った（待${Math.round(w2.w)}分）`);
        tot += w2.w; t = st + w2.w + q.d; loc = q.to; rides++;
      }
      continue;
    }
    let w = dayWait(r.it.key, x, start, r.it.again);
    if (w && w.closed) {
      const c = M.cut[r.it.key], early = c && c.med && w.last < c.med - 60;
      missed.push({ k: r.it.key, ag: r.it.again, kind: early ? "early" : "late", why: early ? `この日は${hm(w.last)}で早く受付終了（ふだんは${hm(c.med)}ごろまで。故障・天候などの可能性）` : `${hm(start)}に着いたが、受付は${hm(w.last)}まで（${cause()}）` });
      t += wk; loc = r.to; recover(r.it.key, r.start + r.wait + r.d, nf); continue;
    }
    if (!w) { w = { w: upper(waitAt(r.it.key, start)) }; unknown.push(r.it.key); }
    // 遅れているときは「必ず」を守る: 「必ず」以外に今並ぶと、あとの「必ず」が間に合わなくなる（予測で試す）なら飛ばして、あとの空き時間に回す
    if (hurry && !mustIt(r.it)) {
      const after = sim.rows.slice(idx + 1).map(q => q.it);
      if (after.some(i => mustIt(i))) {
        const mBad = s2 => s2.rows.filter(q => q.flag && mustIt(q.it)).length;
        if (mBad(simulate(after, { start: start + w.w + r.d, loc: r.to })) > mBad(simulate(after, { start: t + wk, loc: r.to }))) {
          missed.push({ k: r.it.key, ag: r.it.again, kind: "skip", skip: true, why: `遅れていたので、あとの「必ず」を守るために飛ばした（この時の待ち${Math.round(w.w)}分）` });
          t += wk; loc = r.to; pend.push(r); continue;
        }
      }
    }
    if (nf) {
      const R2 = RIDES[nf.it.key], arrive2 = start + w.w + r.d + wkOf(r.to, nf.to);
      if (arrive2 > nf.start + grace(nf)) { missed.push({ k: r.it.key, ag: r.it.again, kind: "skip", skip: true, why: `${R2.short}（${hm(nf.start)}）に間に合わせるため飛ばした（この時の待ち${Math.round(w.w)}分）` }); t += wk; loc = r.to; hurry = true; if (opt.stop) { missed.pop(); return stopAt(idx + 1, [r.it]); } if (S.must.includes(r.it.key)) retry.push(r); else pend.push(r); recover(r.it.key, Infinity, nf); continue; }
    }
    const over = w.w - r.wait;
    if (over >= 10 && (!worst || over > worst.over)) worst = { name: R.short, over };
    tot += w.w; t = start + w.w + r.d; loc = r.to; rides++;
  }
  while (deferred.length) { const { r: q, d } = deferred.shift(); t += wkOf(loc, q.to) + d; loc = q.to; }
  if (pend.length) fitPend(M.close - 15, null);
  return { d: x.d, end: t, tot, late, missed, unknown, rides, subs, notes, planned: sim.rows.filter(r => RIDES[r.it.key]).length };
}

