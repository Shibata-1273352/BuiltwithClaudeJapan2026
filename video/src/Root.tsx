import { Composition, Still } from "remotion";
import timeline from "../timeline.json";
import { Film } from "./Film";
import { Opening } from "./Opening";
import { PathCheck } from "./PathCheck";

const { fps, width, height, opening, end } = timeline;

export const Root = () => (
  <>
    <Composition
      id="Opening"
      component={Opening}
      durationInFrames={Math.round(opening.duration * fps)}
      fps={fps}
      width={width}
      height={height}
    />
    <Composition id="Film" component={Film} durationInFrames={Math.round(end * fps)} fps={fps} width={width} height={height} />
    <Still id="PathCheck" component={PathCheck} width={width} height={height} />
  </>
);
