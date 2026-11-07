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
const DELETED_BOOKMARKS_KEY = "mfr_deleted_bookmarks";
type BookmarkDeletion = { id: string; synced: boolean };

function getBookmarkDeletions(storageKey = scopedStorageKey(DELETED_BOOKMARKS_KEY)): Record<string, BookmarkDeletion> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

export function getLocalBookmarksMap(): Record<string, BookmarkRecord> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(scopedStorageKey(LOCAL_BOOKMARKS_KEY)) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const deleted = getBookmarkDeletions();
    return Object.fromEntries(Object.entries(parsed).filter(([url]) => !deleted[url])) as Record<string, BookmarkRecord>;
  } catch { return {}; }
}

export function getLocalBookmark(fileUrl: string): BookmarkRecord | null {
  return getLocalBookmarksMap()[fileUrl] || null;
}

export function saveLocalBookmark(bookmark: BookmarkRecord, preserveTimestamp = false): void {
  if (typeof window === "undefined" || !bookmark.fileUrl) return;
  try {
    const deleted = getBookmarkDeletions();
    if (preserveTimestamp && deleted[bookmark.fileUrl]) return;
    const map = getLocalBookmarksMap();
    const fields = Object.fromEntries(Object.entries(bookmark).filter(([, value]) => value !== undefined && value !== null));
    map[bookmark.fileUrl] = { ...map[bookmark.fileUrl], ...fields, fileUrl: bookmark.fileUrl,
      lastRead: preserveTimestamp ? bookmark.lastRead || new Date().toISOString() : new Date().toISOString() };
    localStorage.setItem(scopedStorageKey(LOCAL_BOOKMARKS_KEY), JSON.stringify(map));
    // Only an explicit new reading position can replace a deletion marker.
    if (deleted[bookmark.fileUrl]) {
      delete deleted[bookmark.fileUrl];
      localStorage.setItem(scopedStorageKey(DELETED_BOOKMARKS_KEY), JSON.stringify(deleted));
    }
  } catch (err) { console.warn("Failed to save local bookmark:", err); }
}

export function deleteLocalBookmark(fileUrl: string): void {
  if (typeof window === "undefined") return;
  const map = getLocalBookmarksMap();
  delete map[fileUrl];
  localStorage.setItem(scopedStorageKey(LOCAL_BOOKMARKS_KEY), JSON.stringify(map));
}

// Coalesce rapid scrolling and serialize writes so an older request cannot replace a newer position.
const pending = new Map<string, { token: string; bookmark: BookmarkRecord; timer?: ReturnType<typeof setTimeout>; chain: Promise<void> }>();
const deleting = new Map<string, Promise<void>>();

function queueBookmarkDeletion(token: string, fileUrl: string, deletion: BookmarkDeletion, storageKey: string): Promise<void> {
  const key = `${token}:${fileUrl}`;
  const deletionKey = `${key}:${deletion.id}`;
  const inFlight = deleting.get(deletionKey);
  if (inFlight) return inFlight;
  const entry = pending.get(key) || { token, bookmark: { fileUrl }, chain: Promise.resolve() };
  entry.chain = entry.chain.then(async () => {
    if (localStorage.getItem("token") !== token) return;
    await apiClient.deleteBookmark(token, fileUrl);
    const deleted = getBookmarkDeletions(storageKey);
    if (deleted[fileUrl]?.id === deletion.id) {
      // Keep the marker after syncing so an older read response cannot restore it.
      deleted[fileUrl].synced = true;
      localStorage.setItem(storageKey, JSON.stringify(deleted));
    }
  }).catch(error => console.warn("Progress is cleared locally; cloud cleanup will retry:", error));
  pending.set(key, entry);
  const request = entry.chain;
  deleting.set(deletionKey, request);
  void request.then(() => deleting.delete(deletionKey));
  return request;
}

export async function syncBookmarkDeletions(token: string | null): Promise<void> {
  if (!token || typeof window === "undefined" || localStorage.getItem("token") !== token) return;
  const storageKey = scopedStorageKey(DELETED_BOOKMARKS_KEY);
  await Promise.all(Object.entries(getBookmarkDeletions(storageKey))
    .filter(([, deletion]) => !deletion.synced)
    .map(([fileUrl, deletion]) => queueBookmarkDeletion(token, fileUrl, deletion, storageKey)));
}

export async function getBookmarkUnified(token: string | null, fileUrl: string): Promise<BookmarkRecord | null> {
  const storageKey = scopedStorageKey(LOCAL_BOOKMARKS_KEY);
  if (getBookmarkDeletions()[fileUrl]) {
    void syncBookmarkDeletions(token);
    return null;
  }
  const local = getLocalBookmark(fileUrl);
  if (!token) return local;
  try {
    const remote = await apiClient.getBookmark(token, fileUrl);
    if (scopedStorageKey(LOCAL_BOOKMARKS_KEY) !== storageKey) return null;
    if (getBookmarkDeletions()[fileUrl]) return null;
    const currentLocal = getLocalBookmark(fileUrl);
    if (!remote?.fileUrl) return currentLocal;
    if (currentLocal && Date.parse(currentLocal.lastRead || "") > Date.parse(remote.lastRead || "")) return currentLocal;
    saveLocalBookmark(remote, true);
    return remote;
  } catch { return scopedStorageKey(LOCAL_BOOKMARKS_KEY) === storageKey ? getLocalBookmark(fileUrl) : null; }
}

export async function saveBookmarkUnified(token: string | null, bookmark: BookmarkRecord): Promise<void> {
  saveLocalBookmark(bookmark);
  if (!token) return;
  const key = `${token}:${bookmark.fileUrl}`;
  const entry = pending.get(key) || { token, bookmark, chain: Promise.resolve() };
  entry.bookmark = { ...entry.bookmark, ...getLocalBookmark(bookmark.fileUrl), fileUrl: bookmark.fileUrl };
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => {
    entry.timer = undefined;
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
  if (typeof window === "undefined" || localStorage.getItem("token") !== token) return;
  const storageKey = scopedStorageKey(DELETED_BOOKMARKS_KEY);
  const deleted = getBookmarkDeletions(storageKey);
  const deletion = { id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, synced: !token };
  deleted[fileUrl] = deletion;
  localStorage.setItem(storageKey, JSON.stringify(deleted));
  deleteLocalBookmark(fileUrl);
  const key = `${token}:${fileUrl}`;
  const entry = pending.get(key);
  if (entry) {
    clearTimeout(entry.timer);
    entry.timer = undefined;
    entry.bookmark = { fileUrl };
  }
  // Local removal must not wait for an in-flight save or an unavailable backend.
  if (token) void queueBookmarkDeletion(token, fileUrl, deletion, storageKey);
}

// Drain the old URL before a relink changes the server's bookmark key.
export async function flushBookmarkSync(token: string | null, fileUrl: string): Promise<void> {
  if (!token) return;
  const key = `${token}:${fileUrl}`;
  const entry = pending.get(key);
  if (!entry) return;
  clearTimeout(entry.timer);
  entry.timer = undefined;
  if (!getBookmarkDeletions()[fileUrl]) {
    const snapshot = { ...entry.bookmark };
    entry.chain = entry.chain.then(async () => {
      if (localStorage.getItem('token') === token) await apiClient.upsertBookmark(token, snapshot);
    }).catch(error => console.warn('Progress is saved locally; cloud sync failed:', error));
  }
  const chain = entry.chain;
  await chain;
  if (entry.chain === chain && entry.timer === undefined && pending.get(key) === entry) pending.delete(key);
}

export function mergeBookmarks(remote: BookmarkRecord[], local: Record<string, BookmarkRecord>): BookmarkRecord[] {
  const deleted = getBookmarkDeletions();
  const map = new Map(remote.filter(bookmark => !deleted[bookmark.fileUrl]).map(bookmark => [bookmark.fileUrl, bookmark]));
  for (const bookmark of Object.values(local)) {
    if (deleted[bookmark.fileUrl]) continue;
    const existing = map.get(bookmark.fileUrl);
    if (!existing || Date.parse(bookmark.lastRead || "") > Date.parse(existing.lastRead || "")) map.set(bookmark.fileUrl, bookmark);
  }
  return [...map.values()].sort((a, b) => Date.parse(b.lastRead || "") - Date.parse(a.lastRead || ""));
}
