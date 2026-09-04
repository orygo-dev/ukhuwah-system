export type PjjWhiteboardStroke = {
  id: string;
  color: string;
  width: number;
  erase: boolean;
  points: Array<[number, number]>;
};

export type PjjWhiteboardDelta =
  | { sequence: number; kind: "stroke"; stroke: PjjWhiteboardStroke }
  | { sequence: number; kind: "clear" };

export type PjjWhiteboardState = { version: number; strokes: PjjWhiteboardStroke[] };

export const PJJ_WHITEBOARD_MAX_STROKES = 500;

export function applyWhiteboardDelta(
  current: PjjWhiteboardState,
  delta: PjjWhiteboardDelta
): PjjWhiteboardState {
  if (delta.sequence <= current.version) return current;
  if (delta.kind === "clear") return { version: delta.sequence, strokes: [] };
  const withoutDuplicate = current.strokes.filter((stroke) => stroke.id !== delta.stroke.id);
  return {
    version: delta.sequence,
    strokes: [...withoutDuplicate, delta.stroke].slice(-PJJ_WHITEBOARD_MAX_STROKES),
  };
}

export function hydrateWhiteboardState(
  snapshot: PjjWhiteboardState,
  deltas: PjjWhiteboardDelta[]
) {
  return [...deltas]
    .sort((a, b) => a.sequence - b.sequence)
    .reduce(applyWhiteboardDelta, snapshot);
}
