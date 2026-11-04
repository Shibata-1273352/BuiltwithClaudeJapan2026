import { AbsoluteFill, Img, interpolate, OffthreadVideo, Sequence, Series, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import guide from "../public/guide/index.json";
import timeline from "../timeline.json";
import { Opening } from "./Opening";

type Segment = { src?: string; from?: number; to?: number; rate?: number; still?: string; seq?: string; dur?: number; cam?: number[] | null };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const serif = '"Shippori", serif';
const PAPER = "#f3ecdf";
const fonts = `
@font-face { font-family: Shippori; src: url(${staticFile("fonts/ShipporiMincho-Regular.ttf")}); font-weight: 400; }
@font-face { font-family: Shippori; src: url(${staticFile("fonts/ShipporiMincho-Bold.ttf")}); font-weight: 700; }`;

const seconds = (s: Segment) => s.dur ?? ((s.to as number) - (s.from as number)) / (s.rate ?? 1);

/** One shot. `cam` is a fixed framing (x, y of the centre, scale): cuts, never a move on a moving screen. */
const Shot = ({ seg }: { seg: Segment }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [x, y, s] = seg.cam ?? [0.5, 0.5, 1];
  const style = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `translate(${(0.5 - x) * s * 100}%, ${(0.5 - y) * s * 100}%) scale(${s})`,
  } as const;
  return (
    <AbsoluteFill style={{ background: "#0e1426", overflow: "hidden" }}>
      {seg.seq ? (
        <Img src={staticFile(`${seg.seq}/f${String(frame).padStart(4, "0")}.png`)} style={style} />
      ) : seg.still ? (
        <Img src={staticFile(seg.still)} style={style} />
      ) : (
        <OffthreadVideo src={staticFile(seg.src as string)} muted trimBefore={Math.round((seg.from as number) * fps)} style={style} />
      )}
    </AbsoluteFill>
  );
};

/** Edges of a scene breathe through the night of the app; inside one take there is no fade. */
const Fade = ({ len, open, shut }: { len: number; open: boolean; shut: boolean }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame / fps, [0, 0.3, len - 0.3, len], [open ? 1 : 0, 0, 0, shut ? 1 : 0], clamp);
  return <AbsoluteFill style={{ background: "#0e1426", opacity }} />;
};

/** Bridge 1: the threads over the empty frame, gone as the real photo arrives, before any AI output. */
const Bridge = ({ last }: { last: number }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [last, last + 15], [1, 0], clamp);
  return (
    <Img
      src={staticFile(`enter/f${String(Math.min(frame, last)).padStart(4, "0")}.png`)}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity, filter: "saturate(1.25) contrast(1.1)" }}
    />
  );
};

const FadeText = ({ len, children, style }: { len: number; children: React.ReactNode; style: React.CSSProperties }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame / fps, [0, 0.35, len - 0.35, len], [0, 1, 1, 0], clamp);
  return <div style={{ position: "absolute", fontFamily: serif, color: PAPER, opacity, ...style }}>{children}</div>;
};

const Title = () => (
  <AbsoluteFill style={{ background: "rgba(10,12,24,.42)", alignItems: "center", justifyContent: "center", color: PAPER, fontFamily: serif, gap: 26 }}>
    <div style={{ fontSize: 96, letterSpacing: "0.34em", marginRight: "-0.34em" }}>TSUMUGI</div>
    <div style={{ fontSize: 34, letterSpacing: "0.08em" }}>写真一枚から、言葉と時代を越えて、根拠をたどる。</div>
  </AbsoluteFill>
);

const Credit = () => (
  <AbsoluteFill style={{ background: "#0e1426", alignItems: "center", justifyContent: "center", color: PAPER, fontFamily: serif }}>
    <div style={{ fontSize: 72, letterSpacing: "0.3em", marginRight: "-0.3em" }}>TSUMUGI</div>
    <div style={{ fontSize: 28, marginTop: 20, letterSpacing: "0.06em" }}>写真一枚から、言葉と時代を越えて、根拠をたどる。</div>
    <div style={{ fontSize: 44, marginTop: 72, letterSpacing: "0.12em" }}>柴田 高志</div>
    <div style={{ fontSize: 26, marginTop: 14, color: "#b8bfd3" }}>通信事業者 AI エンジニア</div>
    <div style={{ fontSize: 22, marginTop: 64, color: "#b8bfd3" }}>Built with Claude Japan 2026 ／ 音楽は Claude がコードで作曲</div>
  </AbsoluteFill>
);

const Subtitle = ({ text, left }: { text: string; left: boolean }) => (
  <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingLeft: left ? 320 : 0 }}>
    <div style={{ marginBottom: 40, padding: "10px 26px", background: "rgba(14,20,38,.78)", textAlign: "center", color: PAPER, fontFamily: serif, fontSize: 38, lineHeight: 1.4, whiteSpace: "pre-line", borderRadius: 2 }}>
      {text}
    </div>
  </AbsoluteFill>
);

/** The film. App shots are one live run; the threads, the title and the print's framing are made for the film. */
export const Film = () => {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  const scene = (id: string) => timeline.scenes.find((s) => s.id === id)!;
  const read = scene("read");
  return (
    <AbsoluteFill style={{ background: "#0e1426" }}>
      <style>{fonts}</style>
      <Sequence durationInFrames={f(timeline.opening.duration)}>
        <Opening />
      </Sequence>
      <Sequence from={f(timeline.opening.title[0])} durationInFrames={f(timeline.opening.title[1] - timeline.opening.title[0])}>
        <Title />
      </Sequence>
      {timeline.scenes
        .filter((s) => s.segments.length || s.id === "credit")
        .map((s) => (
          <Sequence key={s.id} from={f(s.start)} durationInFrames={f(s.end - s.start)}>
            {s.id === "credit" ? (
              <Credit />
            ) : (
              <Series>
                {(s.segments as Segment[]).map((seg, i) => (
                  <Series.Sequence key={i} durationInFrames={f(seconds(seg))}>
                    <Shot seg={seg} />
                  </Series.Sequence>
                ))}
              </Series>
            )}
            <Fade
              len={s.end - s.start}
              open={!["read", "check", "burn", "gift", "absence"].includes(s.id)}
              shut={!["enter", "absence", "check", "burn"].includes(s.id)}
            />
          </Sequence>
        ))}
      <Sequence from={f(scene("enter").start)} durationInFrames={f(timeline.bridges.enter.duration + 0.6)}>
        <Bridge last={f(timeline.bridges.enter.duration)} />
      </Sequence>
      {timeline.steps.map(([label, at], i) => (
        <Sequence key={String(label)} from={f(read.start + (at as number))} durationInFrames={f(1.6)}>
          <FadeText len={1.6} style={{ right: 96, top: 170 + i * 0, fontSize: 40, background: "rgba(14,20,38,.8)", padding: "8px 20px", borderRadius: 2 }}>
            {label}
          </FadeText>
        </Sequence>
      ))}
      {Object.entries(timeline.notes).map(([id, note]) => (
        <Sequence key={id} from={f(scene(id).start)} durationInFrames={f(Math.min(4, scene(id).end - scene(id).start))}>
          <FadeText len={4} style={{ right: 28, bottom: 18, fontSize: 18, color: "#d9d3c7", textShadow: "0 0 6px #000" }}>
            {note}
          </FadeText>
        </Sequence>
      ))}
      {guide.map((g) => (
        <Sequence key={g.wav} from={f(g.start)} durationInFrames={f(g.seconds)}>
          <Subtitle text={g.sub} left={g.start >= read.start && g.start < read.end} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
