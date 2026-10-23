const { getDocumentType, toLocalUrl } = require('./fileTypes');

function isText(value, maxLength = 4096) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength && !value.includes('\0');
}

function isFileName(value) {
  return isText(value, 255) && !/[\\/]/.test(value);
}

function isEmail(value) {
  return isText(value, 254) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isLocalUrl(value) {
  if (!isText(value) || !value.startsWith('mfr-local://')) return false;
  try {
    const url = new URL(value);
    const pathname = decodeURIComponent(url.pathname);
    return !url.username && !url.password && !url.port && !url.search && !url.hash &&
      pathname.startsWith('/') && !pathname.includes('\0') && Boolean(getDocumentType(pathname));
  } catch { return false; }
}

function localUrlFromId(localId) {
  if (!isText(localId)) return null;
  if (isLocalUrl(localId)) return localId;
  if (!localId.startsWith('/') && !/^[a-zA-Z]:[\\/]/.test(localId) && !localId.startsWith('\\\\')) return null;
  const url = toLocalUrl(localId);
  return isLocalUrl(url) ? url : null;
}

function isHttpUrl(value) {
  if (!isText(value)) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Number((bytes / 1024 ** index).toFixed(2))} ${units[index]}`;
}

// Both Electron (bytes) and the web library (formatted sizes) use these APIs.
function normalizeFileSize(value) {
  if (value === undefined) return '0 B';
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return formatBytes(value);
  if (typeof value === 'string' && (value === 'Local File' || /^\d+(?:\.\d+)?\s*(?:Bytes?|B|KB|MB|GB|TB|PB)$/i.test(value))) return value;
  return null;
}

function isDocumentMime(name, mime) {
  const type = getDocumentType(name);
  return Boolean(type) && (mime === undefined || mime === type || mime === 'application/octet-stream' ||
    (type === 'application/epub+zip' && mime === 'application/x-epub+zip'));
}

module.exports = { isText, isFileName, isEmail, isLocalUrl, localUrlFromId, isHttpUrl, formatBytes, normalizeFileSize, isDocumentMime };
