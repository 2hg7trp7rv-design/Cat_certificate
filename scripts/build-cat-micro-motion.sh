#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
source_png="$repo_root/public/assets/game/IMG_3037.png"
output_dir="$repo_root/public/assets/game/motion/v0.8.2"
output_png="$output_dir/cat-micro.png"
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT

mkdir -p "$output_dir"

# The approved seated source rectangle is copied at 1:1. Its floor pivot
# (95,333) lands on the shared 608x448 cell pivot (256,400).
convert "$source_png" -crop 267x342+75+116 +repage "$work_dir/seated.png"

# Half blink: cover only the upper eye pixels with brow pixels from the same
# source pose. All pixels outside these two bounded masks remain untouched.
convert -size 267x342 xc:black -fill white -stroke none -draw \
  "polygon 47,86 55,78 76,74 89,80 94,88 90,92 82,94 59,94 51,92 46,89 polygon 103,86 111,78 132,74 145,80 150,88 146,92 138,94 115,94 107,92 102,89" \
  "$work_dir/blink-half-mask.png"
convert "$work_dir/blink-half-mask.png" -transparent black "$work_dir/blink-half-alpha.png"
convert "$work_dir/seated.png" -roll +0+16 "$work_dir/blink-half-brow.png"
convert "$work_dir/blink-half-brow.png" "$work_dir/blink-half-alpha.png" \
  -compose DstIn -composite "$work_dir/blink-half-patch.png"
convert "$work_dir/seated.png" "$work_dir/blink-half-patch.png" -compose over -composite \
  -fill '#59301f' -stroke none -draw \
  "polygon 51,89 58,89 65,92 80,92 87,89 93,89 93,93 86,96 62,96 53,93 polygon 104,89 111,89 118,92 133,92 140,89 146,89 146,93 139,96 115,96 106,93" \
  "$work_dir/blink-half.png"

# Closed blink: the same source-locked operation covers the remaining eye
# pixels, then adds two short stepped eyelid curves inside the masks.
convert -size 267x342 xc:black -fill white -stroke none -draw \
  "polygon 47,88 55,78 76,74 89,80 94,91 91,102 82,110 62,110 51,104 46,96 polygon 103,88 111,78 132,74 145,80 150,91 147,102 138,110 118,110 107,104 102,96" \
  "$work_dir/blink-closed-mask.png"
convert "$work_dir/blink-closed-mask.png" -transparent black "$work_dir/blink-closed-alpha.png"
convert "$work_dir/seated.png" -roll +0+22 "$work_dir/blink-closed-brow.png"
convert "$work_dir/blink-closed-brow.png" "$work_dir/blink-closed-alpha.png" \
  -compose DstIn -composite "$work_dir/blink-closed-patch.png"
convert "$work_dir/seated.png" "$work_dir/blink-closed-patch.png" -compose over -composite \
  -fill '#59301f' -stroke none -draw \
  "polygon 53,92 60,92 66,95 79,95 85,92 91,92 91,95 84,99 63,99 55,96 polygon 106,92 112,92 118,95 131,95 137,92 144,92 144,96 136,99 115,99 107,95" \
  "$work_dir/blink-closed.png"

# Distal tail split. The mask contains only source pixels and keeps the base in
# the body, so a small rotation does not cut a triangular hole through the cat.
convert -size 267x342 xc:black -fill white -stroke none -draw \
  "polygon 184,270 194,242 205,215 225,187 260,184 266,194 266,341 184,341" \
  "$work_dir/tail-mask.png"
convert "$work_dir/tail-mask.png" -transparent black "$work_dir/tail-alpha.png"
convert "$work_dir/seated.png" "$work_dir/tail-alpha.png" \
  -compose DstIn -composite "$work_dir/tail-part.png"
convert "$work_dir/seated.png" "$work_dir/tail-alpha.png" \
  -compose DstOut -composite "$work_dir/tail-body.png"

# 2x2 fixed-cell atlas. No frame is trimmed or resampled.
convert -size 1216x896 xc:none \
  "$work_dir/blink-half.png" -geometry +161+67 -composite \
  "$work_dir/blink-closed.png" -geometry +769+67 -composite \
  "$work_dir/tail-body.png" -geometry +161+515 -composite \
  "$work_dir/tail-part.png" -geometry +769+515 -composite \
  "$output_png"

printf '%s\n' "$output_png"
