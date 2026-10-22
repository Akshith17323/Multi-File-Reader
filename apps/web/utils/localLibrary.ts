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
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Failed to parse local library from storage:", err);
    return [];
  }
}

export async function saveLocalFileToLibrary(file: {
  name: string;
  url: string;
  size?: string;
  contentType?: string;
}): Promise<LocalFileRecord> {
  const existingFiles = getLocalLibraryFiles();
  const existingIndex = existingFiles.findIndex((f) => f.url === file.url);

  let record: LocalFileRecord;

  if (existingIndex >= 0) {
    record = {
      ...existingFiles[existingIndex],
      name: file.name,
      metadata: {
        ...existingFiles[existingIndex].metadata,
        size: file.size || existingFiles[existingIndex].metadata.size,
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
        size: file.size || "Local File",
        updated: new Date().toISOString(),
        contentType: file.contentType || "application/octet-stream",
      },
    };
    existingFiles.unshift(record);
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existingFiles));
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
        const updated = existingFiles.map((f) => (f.url === file.url ? record : f));
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
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
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn("Failed to remove local file from storage:", err);
  }
}
