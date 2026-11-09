// Remotion entry: one composition renders any VideoSpec. Pass { spec, words } as input props (--props=job.json).
import React, { useMemo } from "react";
import { Composition } from "remotion";
import type { VideoSpec, Word } from "./spec";
import { timeline } from "./resolve";
import { loadSpec } from "./engine/story";
import { AnimatedShort } from "./engine/Bridge";
import { Overlay } from "./engine/Overlay";

export type JobProps = { spec: VideoSpec; words: Word[] };

const Video: React.FC<JobProps> = ({ spec, words }) => {
  // the engine reads the spec through module state: load it before the world is built
  useMemo(() => loadSpec(spec, words), [spec, words]);
  return <><AnimatedShort /><Overlay spec={spec} words={words} /></>;
};

/** the text layer alone, on a transparent background (previews: composited over an existing render) */
const TextOnly: React.FC<JobProps> = ({ spec, words }) => <Overlay spec={spec} words={words} />;

export const Root: React.FC = () => (
  <>
  <Composition
    id="TextLayer"
    component={TextOnly as unknown as React.FC<Record<string, unknown>>}
    fps={30}
    width={1080}
    height={1920}
    durationInFrames={300}
    defaultProps={{ spec: null, words: [] } as unknown as Record<string, unknown>}
    calculateMetadata={({ props }) => {
      const p = props as unknown as JobProps;
      return { durationInFrames: p.spec ? timeline(p.spec, p.words).frames : 300 };
    }}
  />
  <Composition
    id="AnimatedShort"
    component={Video as unknown as React.FC<Record<string, unknown>>}
    fps={30}
    width={1080}
    height={1920}
    durationInFrames={300}
    defaultProps={{ spec: null, words: [] } as unknown as Record<string, unknown>}
    calculateMetadata={({ props }) => {
      const p = props as unknown as JobProps;
      return { durationInFrames: p.spec ? timeline(p.spec, p.words).frames : 300 };
    }}
  />
</>
);
