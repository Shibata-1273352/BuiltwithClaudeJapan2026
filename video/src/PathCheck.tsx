import { AbsoluteFill, Img, staticFile } from "remotion";
import { CONCEPT_SIZE, CONCEPT_THREAD, spline } from "./thread/curve";

/** The traced curve in cyan over the concept image, to check the trace by eye. */
export const PathCheck = () => {
  const d = spline(CONCEPT_THREAD, 400)
    .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`)
    .join(" ");
  return (
    <AbsoluteFill>
      <Img src={staticFile("concept.png")} style={{ width: "100%", height: "100%" }} />
      <svg viewBox={`0 0 ${CONCEPT_SIZE.width} ${CONCEPT_SIZE.height}`} style={{ position: "absolute", inset: 0 }}>
        <path d={d} fill="none" stroke="#00e5ff" strokeWidth={2} />
      </svg>
    </AbsoluteFill>
  );
};
