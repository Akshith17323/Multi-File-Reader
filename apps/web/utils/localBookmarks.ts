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
    const raw = localStorage.getItem(LOCAL_BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn("Failed to parse local bookmarks:", err);
    return {};
  }
}

export function getLocalBookmark(fileUrl: string): BookmarkRecord | null {
  if (!fileUrl) return null;
  const map = getLocalBookmarksMap();
  return map[fileUrl] || null;
}

export function saveLocalBookmark(bookmark: BookmarkRecord): void {
  if (!bookmark.fileUrl) return;
  try {
    const map = getLocalBookmarksMap();
    map[bookmark.fileUrl] = {
      ...map[bookmark.fileUrl],
      ...bookmark,
      lastRead: new Date().toISOString(),
    };
    localStorage.setItem(LOCAL_BOOKMARKS_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn("Failed to save local bookmark:", err);
  }
}

export function deleteLocalBookmark(fileUrl: string): void {
  if (!fileUrl) return;
  try {
    const map = getLocalBookmarksMap();
    delete map[fileUrl];
    localStorage.setItem(LOCAL_BOOKMARKS_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn("Failed to delete local bookmark:", err);
  }
}

/**
 * Unified Bookmark Fetcher:
 * Tries local storage first for instant loading, then fetches cloud bookmark if authenticated.
 */
export async function getBookmarkUnified(
  token: string | null,
  fileUrl: string
): Promise<BookmarkRecord | null> {
  const local = getLocalBookmark(fileUrl);

  if (!token) {
    return local;
  }

  try {
    const serverData = await apiClient.getBookmark(token, fileUrl);
    if (serverData) {
      const merged: BookmarkRecord = {
        fileUrl,
        fileName: serverData.fileName || local?.fileName,
        pageNumber: serverData.pageNumber || local?.pageNumber,
        totalPages: serverData.totalPages || local?.totalPages,
        cfi: serverData.cfi || local?.cfi,
        progress: serverData.progress !== undefined ? serverData.progress : local?.progress,
        lastRead: serverData.lastRead || local?.lastRead || new Date().toISOString(),
      };
      // Keep local cache up to date
      saveLocalBookmark(merged);
      return merged;
    }
  } catch (err) {
    console.warn("Could not fetch remote bookmark, using local:", err);
  }

  return local;
}

/**
 * Unified Bookmark Saver:
 * Always saves locally first so offline/guest users never lose reading position.
 * If logged in, also syncs to backend.
 */
export async function saveBookmarkUnified(
  token: string | null,
  bookmark: BookmarkRecord
): Promise<void> {
  // Always persist locally
  saveLocalBookmark(bookmark);

  if (token) {
    try {
      await apiClient.upsertBookmark(token, {
        fileUrl: bookmark.fileUrl,
        fileName: bookmark.fileName,
        pageNumber: bookmark.pageNumber,
        totalPages: bookmark.totalPages,
        cfi: bookmark.cfi,
        progress: bookmark.progress,
      });
    } catch (err) {
      console.warn("Failed to sync bookmark to cloud (offline or network error):", err);
    }
  }
}

/**
 * Unified Bookmark Remover
 */
export async function deleteBookmarkUnified(
  token: string | null,
  fileUrl: string
): Promise<void> {
  deleteLocalBookmark(fileUrl);

  if (token) {
    try {
      await apiClient.deleteBookmark(token, fileUrl);
    } catch (err) {
      console.warn("Failed to delete remote bookmark:", err);
    }
  }
}
