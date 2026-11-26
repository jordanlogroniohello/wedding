// Dan & Ange (wedding test): its own Remotion entry, so the series' Root.tsx stays untouched.
// npx remotion still src/wedding/index.ts DanAngeSheet out/wedding/dan-ange-sheet.png
// npx remotion render src/wedding/index.ts DanAngeTest out/wedding/dan-ange-test.mp4
import { registerRoot } from "remotion";
import { WeddingRoot } from "./Root";

registerRoot(WeddingRoot);
