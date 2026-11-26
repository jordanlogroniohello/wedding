import { Composition, Still } from "remotion";
import { loadFont } from "@remotion/google-fonts/Italianno";
import { DanAngeFaceCheck, DanAngeSheet, DanAngeTest } from "./DanAngeSheet";
import { Toast, TOAST } from "./stage/Toast";
import { ToastPoses } from "./stage/ToastPoses";
import { PIGGY_TEST, PiggyRunTest } from "./stage/PiggyRunTest";
import { Piggyback, PIGGYBACK, PIGGY_LOOP, PiggybackLoop } from "./stage/Piggyback";
import { Candles, CANDLES } from "./stage/Candles";
import { CandlesFront, CANDLES_FRONT } from "./stage/CandlesFront";
import { SdeBlueprint, SDE_BLUEPRINT } from "./sde/SdeBlueprint";
import { SdeBlueprint2, SdeBlueprintRef, SDE_BLUEPRINT2, SDE_BLUEPRINT_REF } from "./sde/v2/SdeBlueprint2";

// the LED stage's scenes use the monogram page's script font (the stage page embeds it; here it's loaded for the
// Studio and renders)
loadFont();

export const WeddingRoot: React.FC = () => (
  <>
    <Still id="DanAngeSheet" component={DanAngeSheet} width={1920} height={1080} />
    <Still id="DanAngeFaceCheck" component={DanAngeFaceCheck} width={1920} height={1080} />
    <Still id="ToastPoses" component={ToastPoses} width={1920} height={1080} />
    <Composition id="DanAngeTest" component={DanAngeTest} width={1080} height={1080} fps={30} durationInFrames={135} />
    {/* the LED stage's scenes (transparent; the stage plays them live over the monogram, src/wedding/stage/) */}
    <Composition id="Toast" component={Toast} {...TOAST} />
    {/* (the toast with the traced puppets it had before the painted cut-outs, to compare) */}
    <Composition id="ToastTraced" component={Toast} {...TOAST} defaultProps={{ traced: true }} />
    {/* the piggyback run on its own (round 19), before it goes on the stage as key 2 */}
    <Composition id="PiggyRunTest" component={PiggyRunTest} {...PIGGY_TEST} />
    {/* key 2: the piggyback run across the bottom (round 20) */}
    <Composition id="Piggyback" component={Piggyback} {...PIGGYBACK} />
    {/* (its stride in place, for the strip the stage runs across the whole screen, round 21) */}
    <Composition id="PiggybackLoop" component={PiggybackLoop} {...PIGGY_LOOP} />
    {/* key 3: candles and a kiss, from the user's candle picture (round 23; wide, along the screen's bottom) */}
    <Composition id="Candles" component={Candles} {...CANDLES} />
    {/* key 3 now: the same facing the front (round 24: "naka harap", not side on) */}
    <Composition id="CandlesFront" component={CandlesFront} {...CANDLES_FRONT} />
    {/* the SDE blueprint for the photo + video team: stick figures, camera moves + transitions on the beat (src/wedding/sde/) */}
    <Composition id="SdeBlueprint" component={SdeBlueprint} {...SDE_BLUEPRINT} />
    {/* v2 on the user's own track: no stick figures (faceless people with light), every shot in depth; part 1 = 0:00–0:36 */}
    <Composition id="SdeBlueprint2" component={SdeBlueprint2} {...SDE_BLUEPRINT2} />
    <Composition id="SdeBlueprintRef" component={SdeBlueprintRef} {...SDE_BLUEPRINT_REF} />
  </>
);
