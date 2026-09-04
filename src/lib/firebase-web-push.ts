"use client";

type WebPushConfig = {
  configured: boolean;
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
};

export type WebPushResult =
  | "ENABLED"
  | "PROMPT"
  | "DENIED"
  | "UNSUPPORTED"
  | "NOT_CONFIGURED";

let foregroundListenerReady = false;

async function loadConfig() {
  const response = await fetch("/api/push/config", { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as { enabled: boolean; web: WebPushConfig };
}

function workerUrl(config: WebPushConfig) {
  const query = new URLSearchParams({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });
  return `/firebase-messaging-sw.js?${query.toString()}`;
}

export async function syncWebPush(requestPermission: boolean): Promise<WebPushResult> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) {
    return "UNSUPPORTED";
  }
  const remote = await loadConfig();
  if (!remote?.enabled || !remote.web.configured) return "NOT_CONFIGURED";
  let permission = Notification.permission;
  if (permission === "default" && requestPermission) {
    permission = await Notification.requestPermission();
  }
  if (permission === "default") return "PROMPT";
  if (permission !== "granted") return "DENIED";

  const [{ getApps, initializeApp }, { getMessaging, getToken, isSupported, onMessage }] =
    await Promise.all([import("firebase/app"), import("firebase/messaging")]);
  if (!(await isSupported())) return "UNSUPPORTED";
  const app =
    getApps().find((candidate) => candidate.name === "genpro-web-push") ||
    initializeApp(
      {
        apiKey: remote.web.apiKey,
        authDomain: remote.web.authDomain,
        projectId: remote.web.projectId,
        messagingSenderId: remote.web.messagingSenderId,
        appId: remote.web.appId,
      },
      "genpro-web-push"
    );
  const registration = await navigator.serviceWorker.register(workerUrl(remote.web), {
    scope: "/",
  });
  await navigator.serviceWorker.ready;
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: remote.web.vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) return "UNSUPPORTED";
  const response = await fetch("/api/push/devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      platform: "WEB",
      appId: remote.web.appId,
      deviceName: navigator.platform || "Browser",
    }),
  });
  if (!response.ok) throw new Error("Token push browser gagal didaftarkan.");

  if (!foregroundListenerReady) {
    foregroundListenerReady = true;
    onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || "Navalogi";
      const body = payload.notification?.body || payload.data?.body || "Ada pemberitahuan baru.";
      const notice = new Notification(title, { body, data: payload.data });
      notice.onclick = () => {
        window.focus();
        const destination = payload.data?.actionUrl;
        if (destination) window.location.assign(destination);
        notice.close();
      };
    });
  }
  return "ENABLED";
}
