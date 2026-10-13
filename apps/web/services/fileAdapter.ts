import { isElectron } from "@/hooks/useEnvironment";

export class FileAdapter {
  /**
   * Triggers the native local file picker in Electron and saves the metadata.
   * Throws an error if called from the Web.
   */
  static async addLocalBook(token: string) {
    if (!isElectron()) {
      throw new Error("Local books are only supported in the Desktop app.");
    }

    try {
      const result = await (window as any).electronAPI.invoke('open-local-file-dialog', token);
      if (result.ok) {
        return {
          url: `local://${result.data.file.localId}`,
          fileName: result.data.file.fileName
        };
      } else if (result.error === "Canceled") {
        return null;
      } else {
        throw new Error(result.error || "Failed to add local book");
      }
    } catch (err: any) {
      throw new Error(err.message || "Failed to add local book");
    }
  }

  /**
   * Uploads a file to the Cloud.
   * Adapts the transport mechanism based on the environment (Electron IPC vs Web XMLHttpRequest).
   */
  static async uploadFile(file: File, token: string, uploadEndpoint: string, onProgress: (progress: number) => void): Promise<string> {
    if (isElectron()) {
      onProgress(50);
      try {
        const filePath = (file as any).path;
        if (!filePath) throw new Error("Could not find file path for desktop upload. Try selecting the file again.");

        const result = await (window as any).electronAPI.invoke('upload-dropped-file', {
          filePath,
          token
        });

        if (result.ok) {
          onProgress(100);
          return result.data.url;
        } else {
          throw new Error(result.error || "Upload failed");
        }
      } catch (err: any) {
        throw new Error(err.message || "Upload failed in Electron");
      }
    }

    // Web Standard Upload
    return new Promise(async (resolve, reject) => {
      const fd = new FormData();
      fd.append("UploadingFile", file);

      try {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const objectUrl = URL.createObjectURL(file);

        if (ext === 'pdf') {
          const { pdfjs } = await import("react-pdf");
          pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

          const pdf = await pdfjs.getDocument(objectUrl).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 1.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport } as any).promise;
            const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.8));
            if (blob) fd.append("thumbnail", blob, "thumbnail.jpg");
          }
        } else if (ext === 'epub') {
          const ePub = (await import("epubjs")).default;
          const book = ePub(objectUrl);
          await book.ready;
          const coverUrl = await book.coverUrl();
          if (coverUrl) {
            const response = await fetch(coverUrl);
            const blob = await response.blob();
            fd.append("thumbnail", blob, "thumbnail.jpg");
          }
        }

        URL.revokeObjectURL(objectUrl);
      } catch (e) {
        console.warn("Could not generate thumbnail:", e);
      }

      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadEndpoint);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) onProgress(Math.round((ev.loaded / ev.total) * 100));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const body = JSON.parse(xhr.responseText);
            resolve(body.url);
          } catch {
            reject(new Error("Upload succeeded but response parsing failed"));
          }
        } else {
          try {
            const errBody = JSON.parse(xhr.responseText);
            reject(new Error(errBody.error || errBody.message || `Upload failed: ${xhr.status}`));
          } catch (e) {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
          }
        }
      };

      xhr.onerror = () => reject(new Error("Network/error during upload"));
      xhr.send(fd);
    });
  }
}
