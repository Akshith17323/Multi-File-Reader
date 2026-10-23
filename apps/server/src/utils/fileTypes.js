const path = require('path');
const DOCUMENT_TYPES = { '.pdf': 'application/pdf', '.epub': 'application/epub+zip', '.txt': 'text/plain' };
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function getDocumentType(name) {
  return typeof name === 'string' ? DOCUMENT_TYPES[path.extname(name).toLowerCase()] : undefined;
}

function toLocalUrl(filePath) {
  const normalized = /^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\') ? filePath.replace(/\\/g, '/') : filePath;
  const pathname = normalized.startsWith('/') ? normalized : `/${normalized}`;
  // An explicit host prevents Chromium from treating the first path segment as a hostname.
  return `mfr-local://localhost${encodeURI(pathname).replace(/#/g, '%23').replace(/\?/g, '%3F')}`;
}

function getStorageObjectPath(url, bucketName) {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'storage.googleapis.com') return null;
    const prefix = `/${bucketName}/`;
    if (!parsed.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(parsed.pathname.slice(prefix.length)) || null;
  } catch { return null; }
}

module.exports = { getDocumentType, MAX_FILE_SIZE, toLocalUrl, getStorageObjectPath };
