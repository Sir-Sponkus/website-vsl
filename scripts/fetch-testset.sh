#!/usr/bin/env bash
# Download confusable-sign test videos from the official QIPEDC dictionary into test-set/.
# Idempotent: existing files are skipped. Only video/* responses are saved.
# shortcut: label->entry match is exact (NFC, case-insensitive) plus one alias, Cao (đồ vật) -> "cao (vật)"; re-check if the site adds entries.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/test-set"
BASE="https://qipedc.moet.gov.vn"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

# 1. Full entry list from the site's own search endpoint (empty text = everything).
curl -sS -f -m 60 -X POST "$BASE/dictionary/getAll" \
  --data-urlencode "group=20" --data-urlencode "text=" -o "$TMP/all.json"

# 2. Resolve each label to dictionary ids. Entries with suffix B/N/T are regional variants;
#    they are ordered by suffix: first -> <label>.mp4, then <label>__2.mp4, __3 ...
python3 -I - "$TMP/all.json" "$TMP/plan.tsv" "$TMP/notfound.txt" <<'PY'
import json, sys, unicodedata as u
from collections import defaultdict

LABELS = ["Nên", "Không nên", "Có", "Thích", "Đúng", "Sai", "Anh", "Em", "Chị", "Bố", "Mẹ",
          "Thứ hai", "Thứ ba", "Thứ tư", "Bây giờ", "Buổi sáng", "Buổi trưa", "Buổi chiều",
          "Buổi tối", "Sớm", "Ăn", "Uống", "Mệt", "Cảm ơn", "Xin lỗi", "Đọc", "Viết", "Đi",
          "Chạy", "Ngủ", "Nghỉ ngơi", "Cao (người)", "Cao (đồ vật)", "Nặng"]
# The site has no "cao (đồ vật)"; its object-height entry is "cao (vật)".
ALIAS = {"Cao (đồ vật)": "cao (vật)"}

norm = lambda s: u.normalize("NFC", s).strip().lower()
entries = json.load(open(sys.argv[1], encoding="utf-8"))["data"]
by_word = defaultdict(list)
for e in entries:
    by_word[norm(e["word"])].append(e)

with open(sys.argv[2], "w", encoding="utf-8") as plan, open(sys.argv[3], "w", encoding="utf-8") as nf:
    for label in LABELS:
        hits = by_word.get(norm(ALIAS.get(label, label)), [])
        if not hits:
            nf.write(label + "\n")
            continue
        for k, e in enumerate(sorted(hits, key=lambda e: e["_id"]), start=1):
            name = f"{label}.mp4" if k == 1 else f"{label}__{k}.mp4"
            plan.write("\t".join([label, name, e["_id"], e["word"]]) + "\n")
PY

# 3. Download sequentially, politely, with a content-type check.
while IFS=$'\t' read -r label file id site_word; do
  dest="$OUT/$file"
  if [[ -s "$dest" ]]; then
    echo "skip   $file"
    continue
  fi
  url="$BASE/videos/$id.mp4"
  if ! ctype="$(curl -sS -f -L -m 120 -o "$TMP/v.mp4" -w '%{content_type}' "$url")"; then
    echo "FAIL   $url"
    continue
  fi
  case "$ctype" in
    video/*) mv "$TMP/v.mp4" "$dest"; echo "ok     $file  ($id, '$site_word')" ;;
    *) rm -f "$TMP/v.mp4"; echo "REJECT $url (content-type: $ctype)" ;;
  esac
  sleep 1
done < "$TMP/plan.tsv"

# 4. Manifest of files actually present, plus labels with no site entry.
python3 -I - "$TMP/plan.tsv" "$OUT" "$TMP/notfound.txt" "$BASE" <<'PY'
import json, os, sys
plan, out, nf, base = sys.argv[1:5]
rows = [l.rstrip("\n").split("\t") for l in open(plan, encoding="utf-8") if l.strip()]
manifest = [{"label": label, "file": file, "source_url": f"{base}/videos/{id}.mp4", "site_word": word}
            for label, file, id, word in rows if os.path.exists(os.path.join(out, file))]
json.dump(manifest, open(os.path.join(out, "manifest.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
open(os.path.join(out, "not_found.txt"), "w", encoding="utf-8").write(open(nf, encoding="utf-8").read())
print(f"manifest: {len(manifest)} files")
print("not found:", open(nf, encoding="utf-8").read().replace("\n", ", ").rstrip(", "))
PY
