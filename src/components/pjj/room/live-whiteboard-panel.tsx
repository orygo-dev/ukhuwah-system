"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { Eraser, Paintbrush, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  decodeRoomData,
  isAuthorizedRoomDataMessage,
} from "@/components/pjj/room/live-room-data";
import {
  applyWhiteboardDelta,
  type PjjWhiteboardState,
  type PjjWhiteboardStroke,
} from "@/lib/pjj-whiteboard-state";

type Stroke = PjjWhiteboardStroke;

const COLORS = ["#f8fafc", "#38bdf8", "#fbbf24", "#f87171", "#4ade80", "#c084fc"];

async function readWhiteboardJson(response: Response) {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(
      response.ok
        ? "Respons papan kosong dari server."
        : `Gagal memuat papan (HTTP ${response.status}).`
    );
  }
  try {
    return JSON.parse(text) as {
      error?: string;
      state?: PjjWhiteboardState;
      message?: unknown;
    };
  } catch {
    throw new Error(
      response.ok
        ? "Respons papan bukan JSON valid."
        : `Gagal memuat papan (HTTP ${response.status}).`
    );
  }
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number
) {
  if (stroke.points.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.width;
  ctx.strokeStyle = stroke.erase ? "#0f172a" : stroke.color;
  ctx.globalCompositeOperation = stroke.erase ? "destination-out" : "source-over";
  ctx.beginPath();
  ctx.moveTo(stroke.points[0][0] * width, stroke.points[0][1] * height);
  for (let i = 1; i < stroke.points.length; i += 1) {
    ctx.lineTo(stroke.points[i][0] * width, stroke.points[i][1] * height);
  }
  ctx.stroke();
  ctx.restore();
}

export function LiveWhiteboardPanel({
  liveSessionId,
  canClear,
  identity,
}: {
  liveSessionId: string;
  canClear: boolean;
  identity: string;
}) {
  const room = useRoomContext();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const versionRef = useRef(0);
  const drawingRef = useRef<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(3);
  const [erase, setErase] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);
    for (const stroke of strokesRef.current) {
      drawStroke(ctx, stroke, w, h);
    }
    if (drawingRef.current) {
      drawStroke(ctx, drawingRef.current, w, h);
    }
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(320, Math.floor(rect.width * dpr));
    canvas.height = Math.max(240, Math.floor(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    redraw();
  }, [redraw]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    let cancelled = false;
    const loadState = async () => {
      try {
        const response = await fetch(`/api/pjj/sessions/${liveSessionId}/whiteboard`, {
          cache: "no-store",
        });
        const json = await readWhiteboardJson(response);
        if (!response.ok) throw new Error(json.error || "Gagal memuat papan.");
        if (cancelled) return;
        const state = json.state as PjjWhiteboardState;
        if (!state) throw new Error("Data papan tidak lengkap.");
        versionRef.current = state.version;
        strokesRef.current = state.strokes.slice(-500);
        setError(null);
        redraw();
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Gagal memuat papan.");
        }
      }
    };
    void loadState();
    const onReconnected = () => void loadState();
    room.on(RoomEvent.Reconnected, onReconnected);
    return () => {
      cancelled = true;
      room.off(RoomEvent.Reconnected, onReconnected);
    };
  }, [room, liveSessionId, redraw]);

  useEffect(() => {
    const onData = (
      payload: Uint8Array,
      participant?: { identity: string; name?: string; metadata?: string }
    ) => {
      const message = decodeRoomData(payload);
      if (!isAuthorizedRoomDataMessage(message, participant)) return;
      if (message.type !== "wb:persisted") return;
      const next = applyWhiteboardDelta(
        { version: versionRef.current, strokes: strokesRef.current },
        message.action.kind === "clear"
          ? { sequence: message.sequence, kind: "clear" }
          : { sequence: message.sequence, kind: "stroke", stroke: message.action.stroke }
      );
      versionRef.current = next.version;
      strokesRef.current = next.strokes;
      if (message.action.kind === "clear") drawingRef.current = null;
      redraw();
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, redraw]);

  function pointFromEvent(event: ReactPointerEvent<HTMLCanvasElement>): [number, number] {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return [
      (event.clientX - rect.left) / rect.width,
      (event.clientY - rect.top) / rect.height,
    ];
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = {
      id: `${identity}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      color,
      width,
      erase,
      points: [pointFromEvent(event)],
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const next = pointFromEvent(event);
    const points = drawingRef.current.points;
    const prev = points[points.length - 1];
    // Downsample points to keep LiveKit data payloads small.
    if (prev) {
      const dx = next[0] - prev[0];
      const dy = next[1] - prev[1];
      if (dx * dx + dy * dy < 0.00005) return;
    }
    if (points.length >= 180) return;
    drawingRef.current.points.push(next);
    redraw();
  }

  async function finishStroke() {
    const stroke = drawingRef.current;
    drawingRef.current = null;
    if (!stroke || stroke.points.length < 2) {
      redraw();
      return;
    }
    strokesRef.current = [...strokesRef.current, stroke];
    strokesRef.current = strokesRef.current.slice(-500);
    redraw();
    try {
      const response = await fetch(`/api/pjj/sessions/${liveSessionId}/whiteboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "stroke", stroke }),
      });
      const json = await readWhiteboardJson(response);
      if (!response.ok) throw new Error(json.error || "Gagal menyimpan coretan.");
      setError(null);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Gagal menyimpan coretan.");
    }
  }

  async function clearBoard() {
    strokesRef.current = [];
    drawingRef.current = null;
    redraw();
    try {
      const response = await fetch(`/api/pjj/sessions/${liveSessionId}/whiteboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "clear" }),
      });
      const json = await readWhiteboardJson(response);
      if (!response.ok) throw new Error(json.error || "Gagal mengosongkan papan.");
      setError(null);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Gagal mengosongkan papan.");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          {COLORS.map((item) => (
            <button
              key={item}
              type="button"
              aria-label={`Warna ${item}`}
              className={`h-6 w-6 rounded-full border-2 ${
                color === item && !erase ? "border-cyan-300" : "border-transparent"
              }`}
              style={{ backgroundColor: item }}
              onClick={() => {
                setColor(item);
                setErase(false);
              }}
            />
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant={erase ? "secondary" : "ghost"}
          className="text-xs"
          onClick={() => setErase((current) => !current)}
        >
          <Eraser className="h-3.5 w-3.5" />
          Hapus
        </Button>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <Paintbrush className="h-3.5 w-3.5" />
          <input
            type="range"
            min={2}
            max={14}
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
          />
        </label>
        {canClear ? (
          <Button type="button" size="sm" variant="outline" className="ml-auto text-xs" onClick={() => void clearBoard()}>
            <Trash2 className="h-3.5 w-3.5" />
            Kosongkan
          </Button>
        ) : null}
      </div>
      {error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </div>
      ) : null}
      <div className="relative min-h-[220px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => void finishStroke()}
          onPointerCancel={() => void finishStroke()}
        />
      </div>
      <p className="text-[11px] text-slate-400">
        Gambar sinkron real-time ke peserta lain di room. Guru dapat mengosongkan papan.
      </p>
    </div>
  );
}
