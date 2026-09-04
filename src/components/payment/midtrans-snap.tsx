"use client";

import Script from "next/script";
import { useCallback, useState } from "react";

type MidtransSnapProps = {
  clientKey: string;
  isSandbox: boolean;
  onReady?: () => void;
};

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        }
      ) => void;
    };
  }
}

export function useMidtransSnap({ clientKey, isSandbox, onReady }: MidtransSnapProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const snapUrl = isSandbox
    ? "https://app.sandbox.midtrans.com/snap/snap.js"
    : "https://app.midtrans.com/snap/snap.js";

  const pay = useCallback(
    (
      token: string,
      callbacks: {
        onSuccess?: (result: unknown) => void;
        onPending?: (result: unknown) => void;
        onError?: (result: unknown) => void;
        onClose?: () => void;
      }
    ) => {
      if (!window.snap) {
        callbacks.onError?.({ message: "Midtrans Snap belum dimuat" });
        return;
      }
      window.snap.pay(token, callbacks);
    },
    []
  );

  const SnapScript = (
    <Script
      src={snapUrl}
      data-client-key={clientKey}
      strategy="lazyOnload"
      onLoad={() => {
        setScriptLoaded(true);
        onReady?.();
      }}
    />
  );

  return { SnapScript, pay, scriptLoaded, clientKey };
}
