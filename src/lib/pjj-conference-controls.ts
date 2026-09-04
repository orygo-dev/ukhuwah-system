import type { ControlBarControls } from "@livekit/components-react";

export const PJJ_CONTROL_BAR_CONTROLS: ControlBarControls = Object.freeze({
  chat: false,
});

export function canSelectAudioOutput(mediaElementPrototype: object | null | undefined) {
  return Boolean(
    mediaElementPrototype &&
      "setSinkId" in mediaElementPrototype &&
      typeof (mediaElementPrototype as { setSinkId?: unknown }).setSinkId === "function"
  );
}
