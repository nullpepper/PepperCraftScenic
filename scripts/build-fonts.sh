#!/usr/bin/env bash
#
# 重新生成页面用到的中文子集字体。
# 新增可见中文后运行一次；只依赖系统 Noto CJK 与 pyftsubset。
#
set -euo pipefail

cd "$(dirname "$0")/.."

PYFTSUBSET="${PYFTSUBSET:-$HOME/.cache/pptenv/bin/pyftsubset}"
NOTO_DIR="${NOTO_DIR:-/usr/share/fonts/opentype/noto}"
SANS_REGULAR="$NOTO_DIR/NotoSansCJK-Regular.ttc"
SANS_BOLD="$NOTO_DIR/NotoSansCJK-Bold.ttc"
SERIF_BOLD="$NOTO_DIR/NotoSerifCJK-Bold.ttc"

if [[ ! -x "$PYFTSUBSET" ]]; then
  echo "找不到 pyftsubset：$PYFTSUBSET" >&2
  echo "可用 PYFTSUBSET=/path/to/pyftsubset 指定。" >&2
  exit 1
fi

for file in "$SANS_REGULAR" "$SANS_BOLD" "$SERIF_BOLD"; do
  if [[ ! -f "$file" ]]; then
    echo "找不到字体：$file" >&2
    echo "可用 NOTO_DIR=/path/to/noto 指定。" >&2
    exit 1
  fi
done

tmp="$(mktemp)"
serif_tmp="$(mktemp)"
trap 'rm -f "$tmp" "$serif_tmp"' EXIT

python3 - "$tmp" <<'PY'
import sys
from pathlib import Path

parts = []
for name in ("index.html", "404.html", "assets/js/main.js", "assets/css/style.css"):
    parts.append(Path(name).read_text(encoding="utf-8"))

# 脚本/页面里会动态出现的短句，避免只扫静态 HTML 时漏字。
parts.append("这个坐标不存在。回到首页。页面走丢了。看看世界，或者直接进服。")
parts.append("基岩版怎么进？在游戏的服务器列表里添加；进服后名字前会带一个点，可以用表单。")
parts.append("三张图都拍自服务器实景，不是渲染图。联盟与日均数据截至；开服天数自动更新。")
parts.append("从喜欢的地方开始。山间红石主城花园夜灯木屋。公开接口每分钟更新。")
parts.append("".join(chr(c) for c in range(32, 127)))
parts.append("，。！？；：、“”‘’（）《》〈〉【】…—·×÷≤≥→←↑↓✓©®™°±§¶†‡•‰′″€£¥￥")

chars = "".join(sorted(set("".join(parts))))
Path(sys.argv[1]).write_text(chars, encoding="utf-8")
print(f"子集语料：{len(chars)} 个字符")
PY

printf '“三年之内，不清档。”' > "$serif_tmp"

"$PYFTSUBSET" "$SANS_REGULAR" \
  --font-number=2 --text-file="$tmp" --flavor=woff2 \
  --output-file=assets/fonts/pepper-sans-regular.woff2 --no-hinting
"$PYFTSUBSET" "$SANS_BOLD" \
  --font-number=2 --text-file="$tmp" --flavor=woff2 \
  --output-file=assets/fonts/pepper-sans-bold.woff2 --no-hinting
"$PYFTSUBSET" "$SERIF_BOLD" \
  --font-number=2 --text-file="$serif_tmp" --flavor=woff2 \
  --output-file=assets/fonts/pepper-serif-bold.woff2 --no-hinting

ls -lh assets/fonts/*.woff2
