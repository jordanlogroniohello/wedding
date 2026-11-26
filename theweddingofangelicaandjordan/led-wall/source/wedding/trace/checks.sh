#!/bin/zsh
# Run the wedding test (src/wedding/index.ts, its own entry, not in the main Root) through the project's own checkers,
# unchanged: the motion sheet (scripts/motion-sheet.py) and the hand check (scripts/hand-check.py). They bundle the main
# entry, so this renders their frames from the wedding bundle into the folders they read back with --reuse, the same way
# they render them (half size, the X-ray props). Dan & Ange are in the cast (src/characters/cast.json: their own names,
# humans; the X-ray's colour sets: Dan Kukki's, Ange Miru's), so the reports name them, in a human's words and rules.
# Usage (from gzdnimation/): zsh src/wedding/trace/checks.sh   (DanAngeTest: Dan's wave f54-112 and Ange's bouquet lift f26-80)
#   another composition: COMP=Toast JOBS="40-60 dan pawR,head;40-60 ange pawL,pawR,head" zsh src/wedding/trace/checks.sh
set -e
COMP=${COMP:-DanAngeTest}
# the motion sheets: frames, who, parts
if [[ -n $JOBS ]]; then JOBS=("${(@s/;/)JOBS}"); else JOBS=("54-112 dan pawL,head" "26-80 ange pawL,pawR,head"); fi
BUNDLE=out/wedding/_bundle
PY=.venv/bin/python
CONC=4

echo "bundling src/wedding/index.ts"
rm -rf $BUNDLE
npx remotion bundle src/wedding/index.ts --out-dir=$BUNDLE --log=error

# ---- the motion sheets: X-ray + the rig's log, and the normal picture, every frame of the range
for JOB in $JOBS; do
RANGE=${JOB%% *}; REST=${JOB#* }; WHO=${REST%% *}; PARTS=${REST#* }
A=${RANGE%-*}
B=${RANGE#*-}
W=out/motion-sheet/_work/$COMP-$A-$B
rm -rf $W && mkdir -p $W/xray $W/normal
echo "motion sheet: rendering $COMP $A-$B"
node scripts/render-frames.mjs $BUNDLE $COMP $W/xray --format png --log-file $W/rule-log.jsonl --props '{"handCheck":true,"ruleCheck":true}' --scale 0.5 --every 1 --range $A-$B --concurrency $CONC --timeout 120000 > $W/render.txt
node scripts/render-frames.mjs $BUNDLE $COMP $W/normal --format png --props '{}' --scale 0.5 --every 1 --range $A-$B --concurrency $CONC --timeout 120000 > /dev/null
INFO=$(grep -o "composition [^ ]* [0-9]* [0-9]*x[0-9]* [0-9]*" $W/render.txt | head -1)
echo $INFO | awk '{split($4, s, "x"); printf "{\"fps\": %d, \"w\": %d, \"h\": %d, \"frames\": %d}\n", $3, s[1], s[2], $5}' > $W/info.json
# (one sheet per character: two jobs on the same frames would write one file)
$PY -I scripts/motion-sheet.py $COMP --frames $A-$B --reuse --who $WHO --parts $PARTS --out out/motion-sheet/$COMP-$A-$B-$WHO.png --json out/wedding/motion-$COMP-$A-$B-$WHO.json
done

# ---- the hand check: the X-ray every 2nd frame of the whole composition (it renders the frames its sheet shows itself)
H=out/hand-check/$COMP/frames
rm -rf $H && mkdir -p $H
ln -s "$PWD/$BUNDLE" $H/bundle
echo "hand check: rendering $COMP"
node scripts/render-frames.mjs $BUNDLE $COMP $H/xray --format png --props '{"handCheck":true}' --every 2 --concurrency $CONC --timeout 120000 --log-file $H/log.txt > $H/render.txt
INFO=$(grep -o "composition [^ ]* [0-9]* [0-9]*x[0-9]* [0-9]*" $H/render.txt | head -1)
echo $INFO | awk '{split($4, s, "x"); printf "{\"fps\": %d, \"w\": %d, \"h\": %d, \"frames\": %d}\n", $3, s[1], s[2], $5}' > $H/info.json
$PY -I scripts/hand-check.py $COMP --cast dan,ange --reuse
