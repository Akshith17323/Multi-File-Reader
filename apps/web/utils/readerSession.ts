export interface ReaderSessionData {
  fileUrls: string[];
  activeIndex: number;
  timestamp: number;
}

const SESSION_STORAGE_KEY = "mfr_last_reader_session";

export function saveReaderSession(fileUrls: string[], activeIndex: number): void {
  if (typeof window === "undefined" || !fileUrls || fileUrls.length === 0) return;
  try {
    const data: ReaderSessionData = {
      fileUrls,
      activeIndex: Math.max(0, Math.min(activeIndex, fileUrls.length - 1)),
      timestamp: Date.now(),
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Failed to save reader session to localStorage:", err);
  }
}

export function getLastReaderSession(): ReaderSessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.fileUrls) && parsed.fileUrls.length > 0) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn("Failed to get last reader session:", err);
    return null;
  }
}

export function clearReaderSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear reader session:", err);
  }
}
