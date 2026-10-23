import { isElectron } from "@/hooks/useEnvironment";
import { handleApiFailure } from "./apiClient";
import { saveLocalFileToLibrary } from "@/utils/localLibrary";

interface SelectedLocalFile {
  fileName: string;
  fileSize: number;
  fileType: string;
  url: string;
}

export class FileAdapter {
  static async openLocalFiles(folder = false): Promise<{ files: SelectedLocalFile[]; skipped: number } | null> {
    if (!isElectron()) throw new Error("Open local files in the desktop app.");
    const result = await window.electronAPI!.invoke(folder ? 'open-local-folder' : 'open-local-files');
    if (result.canceled) return null;
    if (result.error) throw new Error(result.error);
    if (!Array.isArray(result.files)) throw new Error("Could not open the selected files.");
    const files: SelectedLocalFile[] = result.files;
    // Save locally before any network work, so a folder is immediately available offline.
    for (const file of files) {
      await saveLocalFileToLibrary({ name: file.fileName, url: file.url, size: file.fileSize, contentType: file.fileType }, false);
    }
    return { files, skipped: result.skipped || 0 };
  }

  static async addLocalBook(token: string) {
    if (!isElectron()) throw new Error("Local books are only supported in the desktop app.");
    const result = await window.electronAPI!.invoke('open-local-file-dialog', token);
    if (result.ok) {
      if (!result.data?.file?.fileUrl) throw new Error("The selected file has no readable location.");
      return { url: result.data.file.fileUrl, fileName: result.data.file.fileName };
    }
    if (result.error === "Canceled") return null;
    handleApiFailure(result.status || 0, result.error || "Failed to add local book", true);
  }

  static async uploadFile(file: File, token: string, uploadEndpoint: string, onProgress: (progress: number) => void): Promise<string> {
    if (isElectron()) {
      onProgress(5);
      const filePath = window.electronAPI?.getFilePath?.(file) || (file as File & { path?: string }).path;
      if (!filePath) throw new Error("Could not find the file on disk. Select it again.");
      const result = await window.electronAPI!.invoke('upload-dropped-file', { filePath, token });
      if (!result.ok) {
        handleApiFailure(result.status || 0, result.error || "Upload failed", true);
      }
      if (typeof result.data?.url !== "string" || !result.data.url) throw new Error("Upload returned no document URL.");
      onProgress(100);
      return result.data.url;
    }

    // Thumbnails are optional. Uploading the document must never wait for a cover renderer.
    const fd = new FormData();
    fd.append("UploadingFile", file);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadEndpoint);
      xhr.timeout = 120000;
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.min(95, Math.round((event.loaded / event.total) * 95)));
      };
      xhr.onload = () => {
        try {
          const body = JSON.parse(xhr.responseText);
          if (xhr.status < 200 || xhr.status >= 300) {
            handleApiFailure(xhr.status, body.error || body.message || `Upload failed (${xhr.status})`, true);
          }
          if (typeof body.url !== "string" || !body.url) throw new Error("Upload returned no document URL.");
          onProgress(100);
          resolve(body.url);
        } catch (error) { reject(error); }
      };
      xhr.onerror = () => reject(new Error("Could not reach the server. Check your connection and retry."));
      xhr.ontimeout = () => reject(new Error("Upload timed out. Please try again."));
      xhr.onabort = () => reject(new Error("Upload was canceled."));
      xhr.send(fd);
    });
  }
}
