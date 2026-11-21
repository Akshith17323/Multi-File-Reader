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
    handleApiFailure(result.status || 0, result.error || "Failed to add local book", token);
  }
}
