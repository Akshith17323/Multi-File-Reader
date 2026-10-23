import { scopedStorageKey } from "./storageScope";
import { apiClient } from "@/services/apiClient";

export interface LocalFileRecord {
  id: string;
  name: string;
  url: string;
  metadata: {
    size: string;
    updated: string;
    contentType: string;
  };
}

const LOCAL_STORAGE_KEY = "mfr_local_library";

export function getLocalLibraryFiles(): LocalFileRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(scopedStorageKey(LOCAL_STORAGE_KEY));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Failed to parse local library from storage:", err);
    return [];
  }
}

export async function saveLocalFileToLibrary(file: {
  name: string;
  url: string;
  size?: string | number;
  contentType?: string;
}): Promise<LocalFileRecord> {
  const storageKey = scopedStorageKey(LOCAL_STORAGE_KEY);
  const size = typeof file.size === "number" ? `${(file.size / 1024).toFixed(1)} KB` : file.size;
  const existingFiles = getLocalLibraryFiles();
  const existingIndex = existingFiles.findIndex((f) => f.url === file.url);

  let record: LocalFileRecord;

  if (existingIndex >= 0) {
    record = {
      ...existingFiles[existingIndex],
      name: file.name,
      metadata: {
        ...existingFiles[existingIndex].metadata,
        size: size || existingFiles[existingIndex].metadata.size,
        contentType: file.contentType || existingFiles[existingIndex].metadata.contentType,
        updated: new Date().toISOString(),
      },
    };
    existingFiles[existingIndex] = record;
  } else {
    record = {
      id: `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      url: file.url,
      metadata: {
        size: size || "Local File",
        updated: new Date().toISOString(),
        contentType: file.contentType || "application/octet-stream",
      },
    };
    existingFiles.unshift(record);
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(existingFiles));
  } catch (err) {
    console.warn("Failed to persist local file to localStorage:", err);
  }

  // If user is authenticated, sync to backend database as well
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      const res = await apiClient.registerLocalFile(token, {
        fileName: file.name,
        fileUrl: file.url,
        fileSize: record.metadata.size,
        fileType: record.metadata.contentType,
      });
      if (res && res.file && res.file.id) {
        record.id = res.file.id;
        // update id in localStorage
        const currentFiles: LocalFileRecord[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
        const updated = currentFiles.map((f) => (f.url === file.url ? { ...f, id: record.id } : f));
        localStorage.setItem(storageKey, JSON.stringify(updated));
      }
    }
  } catch (syncErr) {
    console.warn("Could not sync local file to database (best-effort):", syncErr);
  }

  return record;
}

export function removeLocalLibraryFile(urlOrId: string) {
  if (typeof window === "undefined") return;
  try {
    const existingFiles = getLocalLibraryFiles();
    const filtered = existingFiles.filter((f) => f.url !== urlOrId && f.id !== urlOrId);
    localStorage.setItem(scopedStorageKey(LOCAL_STORAGE_KEY), JSON.stringify(filtered));
  } catch (err) {
    console.warn("Failed to remove local file from storage:", err);
  }
}

export function updateLocalLibraryFile(url: string, changes: { name?: string; url?: string }): void {
  const files = getLocalLibraryFiles().map(file => file.url === url ? { ...file, ...changes } : file);
  localStorage.setItem(scopedStorageKey(LOCAL_STORAGE_KEY), JSON.stringify(files));
}
