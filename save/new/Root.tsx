import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { BridgeShort as HammersmithShort, BRIDGE_FRAMES as HAMMERSMITH_FRAMES } from "./videos/hammersmith/Bridge";

export const Root: React.FC = () => (
  <>
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="HammersmithShort" component={HammersmithShort} durationInFrames={HAMMERSMITH_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
