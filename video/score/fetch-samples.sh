#!/bin/sh
# VSCO 2 Community Edition (CC0): only the instruments the score uses.
set -e
cd "$(dirname "$0")"
[ -d samples/.git ] || git clone --quiet --depth 1 --filter=blob:none --sparse https://github.com/sgossner/VSCO-2-CE.git samples
git -C samples sparse-checkout set --no-cone "/Strings/Cello Section/" "/Strings/Viola Section/" "/Strings/Violin Section/" "/Strings/Solo Violin/" "/Strings/Harp/" "/Percussion/Timpani/" "/Percussion/gongHit_*" "/Percussion/gongscrape_*" "/Percussion/susCymb1-cresc-*" "/Percussion/bassdrum_rub*" "/Percussion/BDrumNewhit_v7*" "/LICENSE"
du -sh samples
