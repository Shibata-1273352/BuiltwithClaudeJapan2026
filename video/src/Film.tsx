import { AbsoluteFill, Img, interpolate, OffthreadVideo, Sequence, Series, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import guide from "../public/guide/index.json";
import timeline from "../timeline.json";
import { Opening } from "./Opening";

type Segment = { src?: string; from?: number; to?: number; rate?: number; still?: string; seq?: string; dur?: number; cam?: number[] | null };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const serif = '"Hiragino Mincho ProN", "Shippori Mincho", serif';

const seconds = (s: Segment) => (s.dur ? s.dur : ((s.to as number) - (s.from as number)) / (s.rate ?? 1));

/** One shot, moved the way a camera would: toward the one thing the viewer should look at. */
const Shot = ({ seg }: { seg: Segment }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const len = seconds(seg);
  const [x, y, a, b] = seg.cam ?? [0.5, 0.5, 1, 1];
  const u = interpolate(frame / fps, [0, len], [0, 1], clamp);
  const style = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `scale(${a + (b - a) * u * u * (3 - 2 * u)})`,
    transformOrigin: `${x * 100}% ${y * 100}%`,
  } as const;
  return (
    <AbsoluteFill style={{ background: "#0e1426", overflow: "hidden" }}>
      {seg.seq ? (
        <Img src={staticFile(`${seg.seq}/f${String(frame).padStart(4, "0")}.png`)} style={style} />
      ) : seg.still ? (
        <Img src={staticFile(seg.still)} style={style} />
      ) : (
        <OffthreadVideo
          src={staticFile(seg.src as string)}
          muted
          trimBefore={Math.round((seg.from as number) * fps)}
          playbackRate={seg.rate ?? 1}
          style={style}
        />
      )}
    </AbsoluteFill>
  );
};

/** Scene edges breathe through the night of the app rather than cut hard. */
const Fade = ({ len, id }: { len: number; id: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // the frozen frame and the live take are one continuous shot: no fade between them
  const open = id === "read" ? 0 : 1;
  const shut = id === "enter" ? 0 : 1;
  const opacity = interpolate(frame / fps, [0, 0.35, len - 0.35, len], [open, 0, 0, shut], clamp);
  return <AbsoluteFill style={{ background: "#0e1426", opacity }} />;
};

/** Bridge 1: the threads over the empty frame, gone as the real photo arrives. Nothing here overlaps AI output. */
const Bridge = ({ last }: { last: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame / fps, [last / fps + 0.05, last / fps + 0.55], [1, 0], clamp);
  return (
    <Img
      src={staticFile(`enter/f${String(Math.min(frame, last)).padStart(4, "0")}.png`)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity, filter: "saturate(1.25) contrast(1.1)" }}
    />
  );
};

const Credit = () => (
  <AbsoluteFill style={{ background: "#0e1426", alignItems: "center", justifyContent: "center", color: "#f3ecdf", fontFamily: serif, gap: 18 }}>
    <div style={{ fontSize: 34 }}>音楽と糸の映像は Claude Code で作りました</div>
    <div style={{ fontSize: 20, color: "#b8bfd3" }}>写真は夕景に調整 / 録画の一部は再生速度を調整 / 題字の画像はコンセプト画像</div>
  </AbsoluteFill>
);

const Subtitle = ({ text }: { text: string }) => (
  <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
    <div style={{ width: "100%", padding: "70px 0 42px", background: "linear-gradient(transparent, rgba(14,20,38,.92) 45%)", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 1300, textAlign: "center", color: "#f3ecdf", fontFamily: serif, fontSize: 30, lineHeight: 1.35 }}>{text}</div>
    </div>
  </AbsoluteFill>
);

/** The film. The app shots are real screen takes; the opening and title are made for the film. */
export const Film = () => {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  const enterAt = timeline.scenes.find((s) => s.id === "enter")?.start ?? 0;
  return (
    <AbsoluteFill style={{ background: "#0e1426" }}>
      <Sequence durationInFrames={f(timeline.opening.duration)}>
        <Opening />
      </Sequence>
      {timeline.scenes.map((s) => (
        <Sequence key={s.id} from={f(s.start)} durationInFrames={f(s.end - s.start)}>
          {s.segments.length ? (
            <Series>
              {(s.segments as Segment[]).map((seg, i) => (
                <Series.Sequence key={i} durationInFrames={f(seconds(seg))}>
                  <Shot seg={seg} />
                </Series.Sequence>
              ))}
            </Series>
          ) : (
            <Credit />
          )}
          <Fade len={s.end - s.start} id={s.id} />
        </Sequence>
      ))}
      <Sequence from={f(enterAt)} durationInFrames={f(timeline.bridges.enter.duration + 0.6)}>
        <Bridge last={f(timeline.bridges.enter.duration)} />
      </Sequence>
      {guide.map((g) => (
        <Sequence key={g.wav} from={f(g.start)} durationInFrames={f(g.seconds)}>
          <Subtitle text={g.en} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
