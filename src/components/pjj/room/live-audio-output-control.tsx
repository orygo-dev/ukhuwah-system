"use client";

import { useCallback, useEffect, useState } from "react";
import { useRoomContext } from "@livekit/components-react";
import { Volume2 } from "lucide-react";
import { canSelectAudioOutput } from "@/lib/pjj-conference-controls";

type OutputDevice = { deviceId: string; label: string };

export function LiveAudioOutputControl() {
  const room = useRoomContext();
  const [supported, setSupported] = useState(false);
  const [devices, setDevices] = useState<OutputDevice[]>([]);
  const [selected, setSelected] = useState("default");
  const [error, setError] = useState<string | null>(null);

  const enumerateOutputs = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return [] as OutputDevice[];
    const all = await navigator.mediaDevices.enumerateDevices();
    return all
      .filter((device) => device.kind === "audiooutput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Speaker ${index + 1}`,
      }));
  }, []);

  useEffect(() => {
    const available = canSelectAudioOutput(HTMLMediaElement.prototype);
    setSupported(available);
    if (!available || !navigator.mediaDevices) return;
    let mounted = true;
    const onDeviceChange = () => {
      void enumerateOutputs()
        .then((nextDevices) => {
          if (mounted) setDevices(nextDevices);
        })
        .catch(() => {
          if (mounted) setError("Daftar speaker tidak dapat diperbarui.");
        });
    };
    void enumerateOutputs()
      .then((nextDevices) => {
        if (mounted) setDevices(nextDevices);
      })
      .catch(() => {
        if (mounted) setError("Daftar speaker tidak dapat dibaca.");
      });
    navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
    return () => {
      mounted = false;
      navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
    };
  }, [enumerateOutputs]);

  if (!supported || devices.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-200 sm:px-4">
      <Volume2 className="h-4 w-4 text-cyan-300" />
      <label htmlFor="pjj-audio-output" className="font-semibold">
        Speaker
      </label>
      <select
        id="pjj-audio-output"
        value={selected}
        className="h-8 min-w-44 rounded-md border border-white/15 bg-slate-950 px-2 text-xs text-white"
        onChange={(event) => {
          const deviceId = event.target.value;
          setSelected(deviceId);
          setError(null);
          void room.switchActiveDevice("audiooutput", deviceId).catch(() => {
            setError("Speaker tidak dapat dipindahkan. Periksa izin browser.");
          });
        }}
      >
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-amber-200">{error}</span> : null}
    </div>
  );
}
