# ThemeParks.wiki の1分ごとの記録（collect/live.mjs → pull.py の data/tpw/日付.csv・runs.log）から、アプリの1日の記録（data/days.json の days[] と同じ形）を作る
#  python tpw_day.py 2026-10-30            … 手元の記録で1日分を作って表示（確かめ用）
#  作り方は app_data.py（ユニバリアルの30分ごとの記録）にそろえる:
#   枠（07:15〜21:45 の毎時15分・45分）の値＝その時刻の直前10分以内に読めた表示。運営中（OPERATING）で今日の lastUpdated の行だけ。
#    向こうの値が30分より古い回（応答の一番新しい今日の lastUpdated が枠の30分より前）は空き（更新停止）。各乗り物のその日の最初の値は除く。午前は実際の開園からの経過で 8:00 開園にそろえる
#   ホラー（RIDES の src が h）: 8〜21時の1時間ごとの平均（運営中の読みの平均）
#   日の平均待ち avg ≒ 1.12×（子ども向けを除く乗り物ごとの1日の平均の平均）− 4.1（ユニバリアルの avg に合わせた。424日で相関0.96・平均のずれ3分）
#   天気 w: 気象庁の大阪府の予報のうち、その日の9時までに出た一番新しい版の、その日の天気（「くもり　時々　晴れ」→「曇時々晴」）
import csv, glob, json, os, re, statistics as st, sys
SLOTS = [f"{7 + (15 + 30 * k) // 60:02d}:{(15 + 30 * k) % 60:02d}" for k in range(30)]
AL = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
KIDS = {"フライングスヌーピー", "エルモのバブルバブル", "モッピー", "エルモのスケートボード", "キティカップケーキ", "エルモのリトルドライブ", "ビッグバードのサーカス", "セサミのビッグドライブ", "スヌーピーフライングエース"}
tmin = lambda s: int(s[11:13]) * 60 + int(s[14:16])  # "2026-10-30 12:13:20" → 733
def jst_of(iso):  # "2026-10-30T03:05:58.733Z" → ("2026-10-30", 725)
    from datetime import datetime, timedelta
    t = datetime.fromisoformat(iso.replace("Z", "+00:00")) + timedelta(hours=9)
    return t.strftime("%Y-%m-%d"), t.hour * 60 + t.minute
def jma_text(w):
    w = re.sub(r"\s+", "", w).replace("晴れ", "晴").replace("くもり", "曇").replace("のち", "後")
    return re.sub(r"(夜|昼前|昼過ぎ|朝|夕方|明け方|夜遅く|未明)", "", w)
def weather(d, jma_files):
    best = None
    for f in jma_files:
        w = json.load(open(f, encoding="utf-8")); at = w[0]["reportDatetime"]
        if at[:10] > d or (at[:10] == d and at[11:16] > "09:00"): continue
        ts = w[0]["timeSeries"][0]; i = next((j for j, t in enumerate(ts["timeDefines"]) if t[:10] == d), None)
        if i is None: continue
        if not best or at > best[0]: best = (at, jma_text(ts["areas"][0]["weathers"][i]))
    return best[1] if best else ""
def build(d, rows, runs, keymap, horror, hours, jma_files=()):
    """rows: [at_jst, entityId, name, type, status, waitTime, lastUpdated, ...]（時刻順）, runs: その日の読んだ時刻 ["2026-10-30 12:13:20", ...]"""
    o, c = hours; sh = o - 480
    snaps = []; state = {}; lu = -1; j = 0
    for at in sorted(runs):
        while j < len(rows) and rows[j][0] <= at:
            r = rows[j]; k = keymap.get(r[1])
            if k:
                ld, lm = jst_of(r[6]) if r[6] else (None, None)
                state[k] = (r[4], int(r[5]) if r[5] not in ("", None) else None, ld == d)
                if ld == d: lu = max(lu, lm)
            j += 1
        snaps.append((tmin(at), lu, dict(state)))
    def at(t):  # 枠 t の直前10分以内の回
        c_ = [s for s in snaps if t - 10 <= s[0] <= t]
        return c_[-1] if c_ else None
    s_out = {}
    for k in sorted({k for k in keymap.values() if k not in horror}):
        cells = ["."] * len(SLOTS); first = True
        for i, sl in enumerate(SLOTS):
            m = int(sl[:2]) * 60 + int(sl[3:]); real = m + sh if m < 720 else m  # 記録の枠（8:00開園にそろえた時刻）と、実際の時刻
            if real < o or real > c: continue
            sn = at(real)
            if not sn or sn[1] < real - 30: continue
            st_ = sn[2].get(k)
            if not st_ or st_[0] != "OPERATING" or st_[1] is None or not st_[2]: continue
            if first: first = False; continue  # その日の最初の値（表示の初期値）は除く
            cells[i] = AL[min(st_[1] // 5, len(AL) - 1)]
        if any(ch != "." for ch in cells): s_out[k] = "".join(cells)
    h_out = {}
    for k in sorted(horror & set(keymap.values())):
        hv = []
        for h in range(8, 22):
            v = [sn[2][k][1] for sn in snaps if h * 60 <= sn[0] < h * 60 + 60 and sn[1] >= sn[0] - 30 and k in sn[2] and sn[2][k][0] == "OPERATING" and sn[2][k][1] is not None and sn[2][k][2]]
            hv.append(AL[min(int(round(st.mean(v) / 5)), len(AL) - 1)] if v else ".")
        if any(ch != "." for ch in hv): h_out[k] = "".join(hv)
    per = [st.mean(AL.index(ch) * 5 for ch in s if ch != ".") for k, s in s_out.items() if k not in KIDS and sum(ch != "." for ch in s) >= 4]
    avg = round(1.12 * st.mean(per) - 4.1) if len(per) >= 5 else None
    return {"d": d, "o": o, "c": c, "avg": avg, "rank": "", "w": weather(d, jma_files), "s": s_out, "h": h_out, "src": "tpw"}
if __name__ == "__main__":
    d = sys.argv[1]; H = os.path.dirname(os.path.abspath(__file__)); W = os.path.join(H, "..", "..", "待ち時間調査", "data")
    html = open(os.path.join(H, "..", "..", "..", "usj_app.html"), encoding="utf-8").read(); i = html.index("const D = ") + 10
    D = json.loads(html[i:].split("\n", 1)[0].strip()[:-1])
    horror = {k for k, r in D["rides"].items() if r.get("src") == "h"}
    rows = [r for r in csv.reader(open(os.path.join(W, "tpw", d + ".csv"), encoding="utf-8"))][1:]
    runs = [l.split(",")[0] for l in open(os.path.join(W, "tpw", "runs.log"), encoding="utf-8") if l.startswith(d)]
    rec = build(d, rows, runs, D["tpw"], horror, tuple(D["hours"].get(d) or (480, 1260)), glob.glob(os.path.join(W, "jma", "270000", "*.json")))
    print(json.dumps(rec, ensure_ascii=False))
