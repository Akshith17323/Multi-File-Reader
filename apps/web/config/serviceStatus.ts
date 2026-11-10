// Enable cloud storage after service verification is complete, then rebuild the web app.
export const CLOUD_STORAGE_ENABLED = process.env.NEXT_PUBLIC_CLOUD_STORAGE_ENABLED === "true";

export const CLOUD_STORAGE_UNAVAILABLE_MESSAGE =
  "Cloud storage is temporarily unavailable. Please use the desktop app to read local PDF, EPUB, and TXT files.";

export const DESKTOP_APP_URL = process.env.NEXT_PUBLIC_DESKTOP_APP_URL ||
  "https://github.com/Akshith17323/Multi-File-Reader#build-the-desktop-application";
