import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import timeline from "../timeline.json";

const { spinEnd, lettersIn, lettersFrames, lanternIn, goldOut, duration, strike } = timeline.opening;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const name = (dir: string, f: number) => staticFile(`${dir}/f${String(f).padStart(4, "0")}.png`);

/**
 * The opening, cut from the two Cycles shots. The spin is flipped so the thread leaves the frame at
 * the right and enters the next shot from the left: the screen direction carries across the cut.
 * The lit lantern and the gold share one transform, so the silk stays on the painted letters.
 */
export const Opening = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const spin = interpolate(t, [lettersIn, spinEnd], [1, 0], clamp);
  const letterFrame = Math.min(lettersFrames, Math.max(0, frame - Math.round(lettersIn * fps)));
  const lantern = interpolate(t, lanternIn, [0, 1], clamp);
  const gold = interpolate(t, goldOut, [1, 0], clamp);
  const push = interpolate(t, [lettersIn, duration], [1, 1.03], clamp);
  // 雷 lands: one flash in the silk, gone in a quarter of a second
  const flash = interpolate(t, [strike - 0.03, strike, strike + 0.28], [1, 1.4, 1], clamp);

  return (
    <AbsoluteFill style={{ background: "#0e1426" }}>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: "50% 50%" }}>
        <Img
          src={staticFile("lantern-dusk.png")}
          style={{
            position: "absolute",
            left: 96,
            top: 0,
            width: 1728,
            height: 1080,
            opacity: lantern,
            maskImage: "linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent)",
          }}
        />
        {t >= lettersIn && (
          <Img
            src={name("letters", letterFrame)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              opacity: gold,
              mixBlendMode: "screen",
              filter: `saturate(1.3) contrast(1.2) brightness(${flash})`,
            }}
          />
        )}
      </AbsoluteFill>
      {t < spinEnd && (
        <Img
          src={name("spin", frame)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            opacity: spin,
            transform: "scaleX(-1)",
            filter: "saturate(1.35) contrast(1.06)",
          }}
        />
      )}
    </AbsoluteFill>
  );
};
