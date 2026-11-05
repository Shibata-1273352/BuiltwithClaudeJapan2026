import { AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, Series, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
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

/** The app is framed, not full bleed: the space under it belongs to the words, so nothing is laid over the UI. */
const FRAME = { left: 134, top: 14, width: 1652, height: 929 };
const FRAMED = ["wall", "press", "enter", "read", "absence", "check", "burn", "gift", "other"];
/** Scenes composed on the film's ground: the words stand under them, with no shade. */
const ON_GROUND = [...FRAMED, "reveal", "close"];
const GOLD = "#e2b65a";
/** The film's own ground, darker than the app's night, so the app reads as a lit screen set on it. */
const STAGE = "#04050a";
const MUTED = "#b8bfd3";

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
  return <AbsoluteFill style={{ background: STAGE, opacity }} />;
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

/**
 * The face of the film. TSUMUGI is stitched by the four threads over the lit lantern, a light runs along
 * the silk, a gold thread is drawn under it and the line settles; then it holds, long enough to be read.
 */
const TITLE_LAST = 96;
const TitleSilk = ({ frame }: { frame: number }) => (
  <Img src={staticFile(`title/f${String(Math.min(frame, TITLE_LAST)).padStart(4, "0")}.png`)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
);

const Title = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const [from, to] = timeline.opening.title;
  const land = timeline.opening.titleLand;
  const len = to - from;
  // the words leave first, on the dark; only then does the lantern come back, so they never cross it
  const words = interpolate(t, [len - 1.0, len - 0.5], [1, 0], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const shade = interpolate(t, [len - 0.6, len], [1, 0], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const thread = interpolate(t, [land + 0.3, land + 1.1], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(4,5,10,.84)", backdropFilter: "blur(16px)", opacity: interpolate(t, [0, 0.5], [0, 1], clamp) * shade }} />
      <AbsoluteFill style={{ opacity: words }}>
      <div style={{ position: "absolute", inset: 0, filter: "saturate(1.15) brightness(1.2)" }}>
        <TitleSilk frame={frame} />
      </div>
      <div style={{ position: "absolute", top: 572, left: 960 - 280 * thread, width: 560 * thread, height: 1, background: GOLD, opacity: 0.8 }} />
      <div
        style={{
          position: "absolute",
          top: 600,
          width: "100%",
          textAlign: "center",
          color: PAPER,
          fontFamily: serif,
          fontSize: 38,
          letterSpacing: "0.12em",
          fontFeatureSettings: '"palt"',
          opacity: interpolate(t, [land + 0.8, land + 1.4], [0, 1], clamp),
        }}
      >
        写真一枚から、言葉と時代を越えて、根拠をたどる。
      </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Credit = () => (
  <AbsoluteFill style={{ background: STAGE, color: PAPER, fontFamily: serif, fontFeatureSettings: '"palt"' }}>
    <div style={{ position: "absolute", inset: 0, transform: "translateY(-176px) scale(.74)" }}>
      <TitleSilk frame={TITLE_LAST} />
    </div>
    <div style={{ position: "absolute", top: 402, width: "100%", textAlign: "center", fontSize: 28, letterSpacing: "0.1em" }}>写真一枚から、言葉と時代を越えて、根拠をたどる。</div>
    <div style={{ position: "absolute", top: 490, left: 900, width: 120, height: 1, background: "rgba(243,236,223,.3)" }} />
    <div style={{ position: "absolute", top: 536, width: "100%", textAlign: "center", fontSize: 58, letterSpacing: "0.22em" }}>柴田 高志</div>
    <div style={{ position: "absolute", top: 628, width: "100%", textAlign: "center", fontSize: 27, letterSpacing: "0.08em", color: MUTED }}>通信事業者 AI エンジニア</div>
    <div style={{ position: "absolute", top: 810, width: "100%", textAlign: "center", fontSize: 23, letterSpacing: "0.06em", color: MUTED, lineHeight: 1.8 }}>
      Built with Claude Japan 2026 ／ ハッカソン期間中に新規開発
      <br />
      音楽と糸の映像は Claude Code で制作
    </div>
  </AbsoluteFill>
);

/** A crop of a still in its own window: `box` is the crop in the image's pixels, shown `width` wide. */
const Crop = ({ src, size, box, width, style }: { src: string; size: [number, number]; box: [number, number, number, number]; width: number; style?: React.CSSProperties }) => {
  const k = width / box[2];
  return (
    <div style={{ position: "relative", width, height: box[3] * k, overflow: "hidden", ...style }}>
      <Img src={staticFile(src)} style={{ position: "absolute", left: -box[0] * k, top: -box[1] * k, width: size[0] * k, height: size[1] * k, maxWidth: "none" }} />
    </div>
  );
};

const HAIRLINE = "0 0 0 1px rgba(243,236,223,.3), 0 14px 70px rgba(70,90,160,.2)";
const caption = { fontFamily: serif, fontSize: 21, letterSpacing: "0.08em", color: MUTED, fontFeatureSettings: '"palt"' } as const;

/** The plate and the two records, side by side. The app underlines the names in the records; the film does the same on the photo. */
const PLATE: [number, number, number, number] = [200, 160, 900, 500];
const CLOSE_UP: [number, number, number, number] = [350, 470, 680, 380];
const RECORD: [number, number, number, number] = [2640, 1080, 1072, 660];
const Reveal = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const ease = (a: number, b: number) => interpolate(t, [a, b], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const move = ease(2.5, 3.2);
  const width = interpolate(move, [0, 1], [1300, 790]);
  const left = interpolate(move, [0, 1], [310, 134]);
  const top = interpolate(move, [0, 1], [80, 300]);
  const k = width / PLATE[2];
  const records = ease(2.9, 3.5); // the record crop already carries the app's own underlines
  const RW = 826;
  // the names, in the coordinates of each crop; the score plucks at the same moments
  const [company, person] = timeline.nameLines;
  const onPlate = [
    { p: "M 150 190 L 600 236", at: company },
    { p: "M 425 338 L 762 346", at: person },
  ];
  const line = (at: number) => ({ strokeDasharray: 1, strokeDashoffset: 1 - ease(at, at + 0.5) });
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <div style={{ position: "absolute", left, top, width, borderRadius: 6, overflow: "hidden", boxShadow: HAIRLINE }}>
        <Crop src="s/plate-photo.png" size={[1500, 750]} box={PLATE} width={width} />
        <svg viewBox={`0 0 ${PLATE[2]} ${PLATE[3]}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {onPlate.map(({ p, at }) => (
            <path key={p} d={p} pathLength={1} stroke={GOLD} strokeWidth={3.2 / k} fill="none" style={line(at)} />
          ))}
        </svg>
      </div>
      <div style={{ ...caption, position: "absolute", left: 138, top: 300 + PLATE[3] * (790 / PLATE[2]) + 14, opacity: records }}>Claude が読んだ写真の銘板（拡大）</div>
      <div style={{ position: "absolute", left: 134, top: 300 + PLATE[3] * (790 / PLATE[2]) + 56, display: "flex", alignItems: "center", gap: 18, opacity: records }}>
        <Crop src="lantern.jpg" size={[1600, 1200]} box={CLOSE_UP} width={170} style={{ borderRadius: 6, boxShadow: HAIRLINE }} />
        <div style={caption}>同じ銘板の接写（別の写真、CC0）</div>
      </div>
      <div style={{ position: "absolute", left: 960, top: 214, opacity: records }}>
        <div style={{ position: "relative", width: RW, borderRadius: 6, overflow: "hidden", boxShadow: HAIRLINE }}>
          <Crop src="s/1961-2x.png" size={[3840, 2160]} box={RECORD} width={RW} />
        </div>
        <div style={{ ...caption, marginTop: 14, marginLeft: 4 }}>記録の原文（アプリの実画面、拡大）</div>
      </div>
    </AbsoluteFill>
  );
};

/** Thousands of threads, and one: two stills from one seed, dissolving, under a slow push (a still, not the app). */
const Reach = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const one = interpolate(t, [2.8, 3.9], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const fill = { position: "absolute", inset: 0, width: "100%", height: "100%" } as const;
  const x = 960 + 0.26 / (1.6 / 1920);
  return (
    <AbsoluteFill style={{ background: STAGE, overflow: "hidden" }}>
      <div style={{ ...fill, transform: `scale(${1 + 0.006 * t})`, transformOrigin: `${x}px 50%` }}>
        <Img src={staticFile("warp/all.png")} style={{ ...fill, filter: "brightness(.72)" }} />
        <Img src={staticFile("warp/one.png")} style={{ ...fill, opacity: one, filter: "brightness(.3)" }} />
        <Img src={staticFile("warp/one.png")} style={{ ...fill, opacity: one, filter: "brightness(1.3)", clipPath: `inset(0 ${1920 - x - 7}px 0 ${x - 7}px)` }} />
        <div style={{ position: "absolute", left: x - 26, top: 0, width: 52, height: "100%", opacity: one * 0.6, background: `linear-gradient(90deg, transparent, ${GOLD}55, transparent)`, mixBlendMode: "screen" }} />
      </div>
      <div style={{ position: "absolute", left: x + 30, top: 400, fontFamily: serif, color: PAPER, opacity: interpolate(t, [3.8, 4.3], [0, 1], clamp), textShadow: "0 0 14px #000" }}>
        <div style={{ fontSize: 40, letterSpacing: "0.03em" }}>Kaminarimon Gate</div>
        <div style={{ fontSize: 22, marginTop: 8, color: MUTED, fontFeatureSettings: '"palt"' }}>観光庁 多言語解説データベース</div>
      </div>
    </AbsoluteFill>
  );
};

/** The postcard as a card, the lantern's warmth far behind it. On 「いまは」 it turns to English, and the friend's two questions are read large. */
const CARD = 900;
const ANSWERS: [number, number, number, number] = [60, 1115, 960, 650];
const Close = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const ease = (a: number, b: number) => interpolate(t, [a, b], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const rise = interpolate(t, [0, 0.8], [14, 0], { ...clamp, easing: Easing.out(Easing.cubic) });
  const english = ease(3.5, 4.1);
  const aside = ease(4.7, 5.4);
  const width = (CARD * 9) / 16;
  const card = { position: "absolute", inset: 0, width: "100%", height: "100%" } as const;
  return (
    <AbsoluteFill style={{ background: STAGE, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 760px 620px at 50% 44%, rgba(224,110,60,.07), transparent)" }} />
      <div style={{ position: "absolute", left: interpolate(aside, [0, 1], [960 - width / 2, 230]), top: 26 + rise, width, height: CARD, borderRadius: 6, overflow: "hidden", boxShadow: "0 0 0 1px rgba(243,236,223,.3), 0 24px 90px rgba(0,0,0,.7)" }}>
        <Img src={staticFile("s/postcard-native.png")} style={card} />
        <Img src={staticFile("s/postcard-en.png")} style={{ ...card, opacity: english }} />
      </div>
      <div style={{ position: "absolute", left: 800, top: 176, opacity: ease(5.1, 5.7) }}>
        <Crop src="s/postcard-en.png" size={[1080, 1920]} box={ANSWERS} width={890} style={{ borderRadius: 6, boxShadow: HAIRLINE }} />
      </div>
    </AbsoluteFill>
  );
};

/** The first line cuts to the plate under the lantern, in the photo the app reads: dark and just out of reach, the question of the film. */
const Plate = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: STAGE, overflow: "hidden" }}>
      <Img src={staticFile("mystery-plate.png")} style={{ width: "100%", height: "100%", transform: `scale(${1 + 0.0035 * (frame / fps)})` }} />
      <AbsoluteFill style={{ background: STAGE, opacity: interpolate(frame, [0, 12, durationInFrames - 15, durationInFrames - 1], [1, 0, 0, 1], clamp) }} />
    </AbsoluteFill>
  );
};

/** Under the frame the words stand alone on the night; over a full-bleed shot a soft shade carries them. */
const Subtitle = ({ text, inFrame }: { text: string; inFrame: boolean }) => (
  <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", pointerEvents: "none" }}>
    {!inFrame && <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 240, background: "linear-gradient(transparent, rgba(8,10,20,.72))" }} />}
    <div
      style={{
        position: "relative",
        marginBottom: inFrame ? 24 : 44,
        textAlign: "center",
        color: PAPER,
        fontFamily: serif,
        fontSize: inFrame ? 34 : 38,
        lineHeight: 1.42,
        letterSpacing: "0.04em",
        fontFeatureSettings: '"palt"',
        whiteSpace: "pre-line",
      }}
    >
      {text}
    </div>
  </AbsoluteFill>
);

const COMPOSED: Record<string, React.ReactNode> = { reveal: <Reveal />, reach: <Reach />, close: <Close />, credit: <Credit /> };

/** The film. App shots are one live run; the threads, the title and the print's framing are made for the film. */
export const Film = () => {
  const { fps } = useVideoConfig();
  const f = (s: number) => Math.round(s * fps);
  const scene = (id: string) => timeline.scenes.find((s) => s.id === id)!;
  const sceneAt = (t: number) => timeline.scenes.find((s) => s.start <= t && t < s.end)?.id ?? "";
  const framed = {
    position: "absolute",
    ...FRAME,
    overflow: "hidden",
    borderRadius: 6,
    boxShadow: "0 0 0 1px rgba(243,236,223,.3), 0 14px 70px rgba(70,90,160,.28)",
  } as const;
  // what the frame shows, said under it: only once the threads have left it, and "enlarged" on a fixed crop
  const labels = ["wall", "press", "read", "absence", "check", "burn", "gift", "other"].flatMap((id) => {
    let at = scene(id).start;
    return (scene(id).segments as Segment[]).map((seg) => {
      const from = at;
      at += seconds(seg);
      return { from: id === "read" ? from + 0.5 : from, to: at, text: id === "wall" ? "ハッカソン期間中に開発したアプリの実画面" : id === "other" ? "アプリの実画面（別の写真：上野・根本中堂）" : seg.cam ? "アプリの実画面（拡大）" : "アプリの実画面" };
    });
  });
  return (
    <AbsoluteFill style={{ background: STAGE }}>
      <style>{fonts}</style>
      <Sequence durationInFrames={f(timeline.opening.duration)}>
        <Opening />
      </Sequence>
      <Sequence from={f(timeline.opening.title[0])} durationInFrames={f(timeline.opening.title[1] - timeline.opening.title[0])}>
        <Title />
      </Sequence>
      {timeline.scenes
        .filter((s) => s.segments.length || s.id in COMPOSED)
        .map((s) => (
          <Sequence key={s.id} from={f(s.start)} durationInFrames={f(s.end - s.start)}>
            {s.id in COMPOSED ? (
              COMPOSED[s.id]
            ) : (
              <div style={FRAMED.includes(s.id) ? framed : { position: "absolute", inset: 0 }}>
                <Series>
                  {(s.segments as Segment[]).map((seg, i) => (
                    <Series.Sequence key={i} durationInFrames={f(seconds(seg))}>
                      <Shot seg={seg} />
                    </Series.Sequence>
                  ))}
                </Series>
              </div>
            )}
            <Fade
              len={s.end - s.start}
              open={!["read", "check", "burn", "gift"].includes(s.id)}
              shut={!["enter", "absence", "check", "burn"].includes(s.id)}
            />
          </Sequence>
        ))}
      <Sequence from={f(scene("enter").start)} durationInFrames={f(timeline.bridges.enter.duration + 0.6)}>
        <div style={framed}>
          <Bridge last={f(timeline.bridges.enter.duration)} />
        </div>
      </Sequence>
      <Sequence from={f(scene("mystery").start + timeline.opening.plateCut)} durationInFrames={f(scene("mystery").end - scene("mystery").start - timeline.opening.plateCut)}>
        <Plate />
      </Sequence>
      {labels.map((l) => (
        <Sequence key={l.from} from={f(l.from)} durationInFrames={f(l.to - l.from)}>
          <div style={{ position: "absolute", right: 1920 - FRAME.left - FRAME.width + 4, top: FRAME.top + FRAME.height + 12, fontFamily: serif, fontSize: 19, letterSpacing: "0.08em", color: MUTED }}>{l.text}</div>
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
          <Subtitle text={g.sub} inFrame={ON_GROUND.includes(sceneAt(g.start))} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
