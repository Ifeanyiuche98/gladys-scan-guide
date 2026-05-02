// Persistent per-device client identifier used for fair rate limiting.
// Generated once on first visit and reused across sessions.

const KEY = "gladys_client_id";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // RFC4122 v4 fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getClientId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(KEY, id);
      if (import.meta.env.DEV) {
        console.debug("[gladys] generated new client_id:", id);
      }
    }
    return id;
  } catch {
    // Fallback if localStorage unavailable — non-persistent
    return uuid();
  }
}
