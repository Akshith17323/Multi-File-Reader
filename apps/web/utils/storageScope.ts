// Keep local reading data separate for each account and for guests.
export function getStorageScope(): string {
  if (typeof window === "undefined") return "guest";
  const token = localStorage.getItem("token");
  if (!token) return "guest";
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof payload.userId === "string") return payload.userId;
  } catch { /* A malformed session must not share another account's cache. */ }
  return `session_${encodeURIComponent(token)}`;
}

export function scopedStorageKey(key: string): string {
  return `${key}:${getStorageScope()}`;
}
