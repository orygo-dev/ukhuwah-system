export type SingleFlightResult<T> =
  | { status: "success"; value: T }
  | { status: "error"; error: unknown }
  | { status: "aborted" }
  | { status: "skipped" };

export function createSingleFlightRunner({ timeoutMs = 0 }: { timeoutMs?: number } = {}) {
  let active: AbortController | null = null;
  let activeTimeout: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  return {
    get running() {
      return active !== null;
    },
    async run<T>(task: (signal: AbortSignal) => Promise<T>): Promise<SingleFlightResult<T>> {
      if (stopped || active) return { status: "skipped" };
      const controller = new AbortController();
      active = controller;
      let timedOut = false;
      const timeout = timeoutMs > 0 ? setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs) : null;
      activeTimeout = timeout;
      try {
        const value = await task(controller.signal);
        if (timedOut && !stopped) return { status: "error", error: new Error("Permintaan terlalu lama. Silakan coba lagi.") };
        if (controller.signal.aborted || stopped) return { status: "aborted" };
        return { status: "success", value };
      } catch (error) {
        if (timedOut && !stopped) return { status: "error", error: new Error("Permintaan terlalu lama. Silakan coba lagi.") };
        if (controller.signal.aborted || stopped) return { status: "aborted" };
        return { status: "error", error };
      } finally {
        if (timeout !== null) clearTimeout(timeout);
        if (activeTimeout === timeout) activeTimeout = null;
        if (active === controller) active = null;
      }
    },
    stop() {
      stopped = true;
      if (activeTimeout !== null) clearTimeout(activeTimeout);
      activeTimeout = null;
      active?.abort();
      active = null;
    },
  };
}
