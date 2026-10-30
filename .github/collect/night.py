# 毎晩（GitHub の定期実行 collect.yml の night）: その日の1分ごとの記録（data 枝の tpw/日付/*.enc）からアプリの1日分の記録を作り、公開ページの recent.js に足す
#  python night.py <data 枝のフォルダ> <公開ページのフォルダ> [日付]   鍵は環境変数 TPW_KEY
#  recent.js は window.RECENT = { days: [...] }。アプリ（engine.js の先頭）が読み込んで記録に足す（ユニバリアルの記録がある日はそちらを優先）
import csv, glob, gzip, io, json, os, subprocess, sys
from datetime import datetime, timedelta
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tpw_day import build
G, SITE = sys.argv[1], sys.argv[2]
d = sys.argv[3] if len(sys.argv) > 3 else (datetime.utcnow() + timedelta(hours=9)).strftime("%Y-%m-%d")
html = open(os.path.join(SITE, "index.html"), encoding="utf-8").read(); i = html.index("const D = ") + 10
D = json.loads(html[i:].split("\n", 1)[0].strip()[:-1])
rows, runs = [], set()
for f in sorted(glob.glob(os.path.join(G, "tpw", d, "*.enc"))):
    body = subprocess.run(["openssl", "enc", "-d", "-aes-256-cbc", "-md", "sha256", "-pbkdf2", "-iter", "100000", "-pass", "env:TPW_KEY", "-in", f], check=True, capture_output=True).stdout
    x = json.loads(gzip.decompress(body)); runs.update(r.split(",")[0] for r in x["runs"]); rows += list(csv.reader(io.StringIO("\n".join(x["rows"]))))
seen, uniq = set(), []
for r in sorted(rows, key=lambda r: r[0]):  # 重ねて読んだ回の同じ行はまとめる（pull.py と同じ）
    if (r[1], r[6]) not in seen: seen.add((r[1], r[6])); uniq.append(r)
if not runs: sys.exit(f"{d}: 記録なし")
horror = {k for k, r in D["rides"].items() if r.get("src") == "h"}
rec = build(d, uniq, sorted(runs), D["tpw"], horror, tuple(D["hours"].get(d) or (480, 1260)), glob.glob(os.path.join(G, "jma", "270000", "*.json")))
p = os.path.join(SITE, "recent.js")
old = json.loads(open(p, encoding="utf-8").read().split("=", 1)[1].rstrip().rstrip(";")) if os.path.exists(p) else {"days": []}
days = sorted([x for x in old["days"] if x["d"] != d] + [rec], key=lambda x: x["d"])
open(p, "w", encoding="utf-8", newline="\n").write("// 毎晩の記録（GitHub の定期実行が ThemeParks.wiki の1分ごとの記録から作る。Powered by ThemeParks.wiki）\nwindow.RECENT = " + json.dumps({"days": days}, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(f"{d}: 乗り物 {len(rec['s'])}・ホラー {len(rec['h'])}・平均 {rec['avg']}・天気 {rec['w']}・読んだ回 {len(runs)}")
