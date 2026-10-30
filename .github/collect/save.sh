#!/bin/bash
# out/ の中身を data 枝に足して push する（公開ページの main 枝は触らない）。すでにある名前は上書きしない。同時に走った回とぶつかったら取り込み直して5回まで
set -e
URL="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
git config --global user.name "github-actions[bot]"; git config --global user.email "41898282+github-actions[bot]@users.noreply.github.com"
if git ls-remote --exit-code --heads "$URL" data >/dev/null; then git clone -q --depth 1 --branch data "$URL" d; else git init -q -b data d; git -C d remote add origin "$URL"; fi
cp -rn out/. d/
cd d; git add -A
git diff --cached --quiet && { echo "足すものなし"; exit 0; }
git commit -qm "$1"
for i in 1 2 3 4 5; do git push -q origin data && exit 0; sleep $((i * 7)); git pull -q --rebase origin data || true; done
exit 1
