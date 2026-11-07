import { normalizeFileUrl } from "./fileUrls";
import { scopedStorageKey } from "./storageScope";

export interface ReaderSessionData {
  fileUrls: string[];
  activeIndex: number;
  timestamp: number;
}

const SESSION_STORAGE_KEY = "mfr_last_reader_session";

export function clampActiveIndex(index: number, count: number): number {
  return Number.isFinite(index) ? Math.max(0, Math.min(Math.trunc(index), Math.max(0, count - 1))) : 0;
}

export function parseReaderFiles(value: string | null): string[] {
  if (!value) return [];
  let urls: unknown;
  try { urls = JSON.parse(value); }
  catch { urls = value.split(","); }
  if (!Array.isArray(urls)) return [];
  return [...new Set(urls.filter((url): url is string => typeof url === "string" && url.trim().length > 0)
    .map(normalizeFileUrl).filter(url => /^(https?:|mfr-local:|blob:|data:)/.test(url)))];
}

export function createReaderUrl(fileUrls: string[], activeIndex = 0): string {
  const params = new URLSearchParams({ files: JSON.stringify(fileUrls), active: String(clampActiveIndex(activeIndex, fileUrls.length)) });
  return `/reader?${params}`;
}

export function saveReaderSession(fileUrls: string[], activeIndex: number): void {
  if (typeof window === "undefined" || fileUrls.length === 0) return;
  try {
    const data: ReaderSessionData = { fileUrls, activeIndex: clampActiveIndex(activeIndex, fileUrls.length), timestamp: Date.now() };
    localStorage.setItem(scopedStorageKey(SESSION_STORAGE_KEY), JSON.stringify(data));
  } catch (err) { console.warn("Failed to save reader session:", err); }
}

export function getLastReaderSession(): ReaderSessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(scopedStorageKey(SESSION_STORAGE_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const fileUrls = parseReaderFiles(JSON.stringify(parsed.fileUrls));
    if (!fileUrls.length) return null;
    return { fileUrls, activeIndex: clampActiveIndex(parsed.activeIndex, fileUrls.length), timestamp: parsed.timestamp || 0 };
  } catch { return null; }
}

export function clearReaderSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(scopedStorageKey(SESSION_STORAGE_KEY));
  sessionStorage.removeItem("readerFiles");
}

export function removeFileFromReaderSession(url: string): void {
  const session = getLastReaderSession();
  if (!session) return;
  const urls = session.fileUrls.filter(item => item !== url);
  if (!urls.length) clearReaderSession();
  else {
    const previousActiveUrl = session.fileUrls[session.activeIndex];
    saveReaderSession(urls, Math.max(0, urls.indexOf(previousActiveUrl)));
    sessionStorage.setItem("readerFiles", JSON.stringify(urls));
  }
}
