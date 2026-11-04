import { Composition, Still } from "remotion";
import timeline from "../timeline.json";
import { Opening } from "./Opening";
import { PathCheck } from "./PathCheck";

const { fps, width, height, opening } = timeline;

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
    <Still id="PathCheck" component={PathCheck} width={width} height={height} />
  </>
);
