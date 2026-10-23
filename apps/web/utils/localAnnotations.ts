import { scopedStorageKey } from "./storageScope";
export interface AnnotationRecord {
  id: string;
  fileUrl: string;
  type: "highlight" | "note" | "bookmark";
  pageNumber?: number;
  cfi?: string;
  selectedText?: string;
  color?: string; // hex or CSS color
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

const LOCAL_ANNOTATIONS_KEY_PREFIX = "mfr_local_annotations_";

function getStorageKey(fileUrl: string): string {
  return scopedStorageKey(`${LOCAL_ANNOTATIONS_KEY_PREFIX}${encodeURIComponent(fileUrl)}`);
}

export function getLocalAnnotations(fileUrl: string): AnnotationRecord[] {
  if (typeof window === "undefined" || !fileUrl) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(fileUrl));
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Failed to load local annotations:", err);
    return [];
  }
}

export function saveLocalAnnotation(annotation: AnnotationRecord): AnnotationRecord[] {
  if (typeof window === "undefined" || !annotation.fileUrl) return [];
  try {
    const list = getLocalAnnotations(annotation.fileUrl);
    const existingIndex = list.findIndex((a) => a.id === annotation.id);
    if (existingIndex >= 0) {
      list[existingIndex] = {
        ...list[existingIndex],
        ...annotation,
        updatedAt: new Date().toISOString(),
      };
    } else {
      list.push({
        ...annotation,
        createdAt: annotation.createdAt || new Date().toISOString(),
      });
    }
    localStorage.setItem(getStorageKey(annotation.fileUrl), JSON.stringify(list));
    return list;
  } catch (err) {
    console.warn("Failed to save local annotation:", err);
    return [];
  }
}

export function deleteLocalAnnotation(id: string, fileUrl: string): AnnotationRecord[] {
  if (typeof window === "undefined" || !fileUrl) return [];
  try {
    const list = getLocalAnnotations(fileUrl).filter((a) => a.id !== id);
    localStorage.setItem(getStorageKey(fileUrl), JSON.stringify(list));
    return list;
  } catch (err) {
    console.warn("Failed to delete local annotation:", err);
    return [];
  }
}

export function migrateLocalAnnotations(oldUrl: string, newUrl: string): void {
  if (typeof window === "undefined" || !oldUrl || !newUrl) return;
  try {
    const existing = getLocalAnnotations(oldUrl);
    if (existing.length === 0) return;
    const updated = existing.map((a) => ({ ...a, fileUrl: newUrl }));
    localStorage.setItem(getStorageKey(newUrl), JSON.stringify(updated));
    localStorage.removeItem(getStorageKey(oldUrl));
  } catch (err) {
    console.warn("Failed to migrate local annotations:", err);
  }
}
