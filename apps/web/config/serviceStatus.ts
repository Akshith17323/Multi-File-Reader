// This flag only controls legacy hosted-document reads, not uploads or Drive imports.
export const CLOUD_STORAGE_ENABLED = process.env.NEXT_PUBLIC_CLOUD_STORAGE_ENABLED === "true";

export const CLOUD_STORAGE_UNAVAILABLE_MESSAGE =
  "Hosted cloud documents are unavailable. Open the original PDF, EPUB, or TXT file in the desktop app. Google Drive import is coming soon.";

export const DESKTOP_APP_URL = process.env.NEXT_PUBLIC_DESKTOP_APP_URL ||
  "https://github.com/Akshith17323/Multi-File-Reader#build-the-desktop-application";
