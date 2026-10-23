import { scopedStorageKey } from "./storageScope";
import { apiClient } from "@/services/apiClient";

export interface BookmarkRecord {
  fileUrl: string;
  fileName?: string;
  pageNumber?: number;
  totalPages?: number;
  cfi?: string;
  progress?: number;
  lastRead?: string;
}

const LOCAL_BOOKMARKS_KEY = "mfr_local_bookmarks";

export function getLocalBookmarksMap(): Record<string, BookmarkRecord> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(scopedStorageKey(LOCAL_BOOKMARKS_KEY)) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

export function getLocalBookmark(fileUrl: string): BookmarkRecord | null {
  return getLocalBookmarksMap()[fileUrl] || null;
}

export function saveLocalBookmark(bookmark: BookmarkRecord, preserveTimestamp = false): void {
  if (typeof window === "undefined" || !bookmark.fileUrl) return;
  try {
    const map = getLocalBookmarksMap();
    const fields = Object.fromEntries(Object.entries(bookmark).filter(([, value]) => value !== undefined && value !== null));
    map[bookmark.fileUrl] = { ...map[bookmark.fileUrl], ...fields, fileUrl: bookmark.fileUrl,
      lastRead: preserveTimestamp ? bookmark.lastRead || new Date().toISOString() : new Date().toISOString() };
    localStorage.setItem(scopedStorageKey(LOCAL_BOOKMARKS_KEY), JSON.stringify(map));
  } catch (err) { console.warn("Failed to save local bookmark:", err); }
}

export function deleteLocalBookmark(fileUrl: string): void {
  if (typeof window === "undefined") return;
  const map = getLocalBookmarksMap();
  delete map[fileUrl];
  localStorage.setItem(scopedStorageKey(LOCAL_BOOKMARKS_KEY), JSON.stringify(map));
}

export async function getBookmarkUnified(token: string | null, fileUrl: string): Promise<BookmarkRecord | null> {
  const local = getLocalBookmark(fileUrl);
  if (!token) return local;
  try {
    const remote = await apiClient.getBookmark(token, fileUrl);
    if (!remote?.fileUrl) return local;
    if (local && Date.parse(local.lastRead || "") > Date.parse(remote.lastRead || "")) return local;
    saveLocalBookmark(remote, true);
    return remote;
  } catch { return local; }
}

// Coalesce rapid scrolling and serialize writes so an older request cannot replace a newer position.
const pending = new Map<string, { token: string; bookmark: BookmarkRecord; timer?: ReturnType<typeof setTimeout>; chain: Promise<void> }>();

export async function saveBookmarkUnified(token: string | null, bookmark: BookmarkRecord): Promise<void> {
  saveLocalBookmark(bookmark);
  if (!token) return;
  const key = `${token}:${bookmark.fileUrl}`;
  const entry = pending.get(key) || { token, bookmark, chain: Promise.resolve() };
  entry.bookmark = { ...entry.bookmark, ...getLocalBookmark(bookmark.fileUrl), fileUrl: bookmark.fileUrl };
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    const snapshot = { ...entry.bookmark };
    entry.chain = entry.chain.then(async () => {
      // Do not send a position captured for an account that has since signed out.
      if (localStorage.getItem("token") !== entry.token) return;
      await apiClient.upsertBookmark(entry.token, snapshot);
    }).catch(error => console.warn("Progress is saved locally; cloud sync failed:", error));
  }, 500);
  pending.set(key, entry);
}

export async function deleteBookmarkUnified(token: string | null, fileUrl: string): Promise<void> {
  const key = `${token}:${fileUrl}`;
  const entry = pending.get(key);
  if (entry) {
    clearTimeout(entry.timer);
    await entry.chain;
    pending.delete(key);
  }
  if (token) await apiClient.deleteBookmark(token, fileUrl);
  deleteLocalBookmark(fileUrl);
}

export function mergeBookmarks(remote: BookmarkRecord[], local: Record<string, BookmarkRecord>): BookmarkRecord[] {
  const map = new Map(remote.map(bookmark => [bookmark.fileUrl, bookmark]));
  for (const bookmark of Object.values(local)) {
    const existing = map.get(bookmark.fileUrl);
    if (!existing || Date.parse(bookmark.lastRead || "") > Date.parse(existing.lastRead || "")) map.set(bookmark.fileUrl, bookmark);
  }
  return [...map.values()].sort((a, b) => Date.parse(b.lastRead || "") - Date.parse(a.lastRead || ""));
}
