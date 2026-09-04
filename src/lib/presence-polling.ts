import { PRESENCE_POLL_MS } from "./student-presence-policy";

// Single-flight, timeout-bounded polling shared by sender and monitor.
// Returning false stops on authentication/authorization failures.
export function createPresencePoller(
  task: (signal: AbortSignal) => Promise<boolean | void>,
  isActive: () => boolean,
  intervalMs = PRESENCE_POLL_MS,
) {
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: AbortController | undefined;
  let resumePending = false;
  const stop = () => {
    disposed = true;
    clearTimeout(timer);
    running?.abort();
  };
  const refresh = () => {
    clearTimeout(timer);
    if (disposed) return;
    if (!isActive()) { resumePending = false; running?.abort(); return; }
    if (running) { resumePending = running.signal.aborted; return; }
    const controller = new AbortController();
    running = controller;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    void Promise.resolve().then(() => !disposed && !controller.signal.aborted ? task(controller.signal) : undefined).then((result) => {
      if (result === false) stop();
    }).catch(() => {
      // Presence is optional. Retry only on the next bounded interval.
    }).finally(() => {
      clearTimeout(timeout);
      running = undefined;
      if (!disposed && isActive()) timer = setTimeout(refresh, resumePending ? 0 : intervalMs);
      resumePending = false;
    });
  };
  return { refresh, stop };
}

export function startVisiblePresencePolling(task: (signal: AbortSignal) => Promise<boolean | void>) {
  const poller = createPresencePoller(task, () => document.visibilityState === "visible" && navigator.onLine);
  document.addEventListener("visibilitychange", poller.refresh);
  window.addEventListener("online", poller.refresh);
  window.addEventListener("offline", poller.refresh);
  poller.refresh();
  return () => {
    poller.stop();
    document.removeEventListener("visibilitychange", poller.refresh);
    window.removeEventListener("online", poller.refresh);
    window.removeEventListener("offline", poller.refresh);
  };
}
