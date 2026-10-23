const fs = require('fs');
const path = require('path');
const { pathToFileURL, fileURLToPath } = require('url');
const { getDocumentType, MAX_FILE_SIZE, toLocalUrl } = require('../../server/src/utils/fileTypes');
const { net, BrowserWindow } = require('electron');

let isRegistered = false;

function extractPathFromLocalUrl(rawUrl, platform = process.platform) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let filePath = rawUrl;
  if (filePath.startsWith('mfr-local://')) {
    filePath = decodeURIComponent(filePath.replace(/^mfr-local:\/\//, ''));
    if (filePath.startsWith('localhost/')) filePath = filePath.slice('localhost'.length);
    // Older URLs without an explicit host are rewritten by Chromium as host/path.
    if (!filePath.startsWith('/') && !/^[a-zA-Z]:[\\/]/.test(filePath)) filePath = `/${filePath}`;
  } else if (filePath.startsWith('file://')) {
    filePath = fileURLToPath(filePath, { windows: platform === 'win32' });
  } else if (filePath.startsWith('local://')) {
    filePath = filePath.slice(8);
  }
  if (platform === 'win32' && filePath.startsWith('/') && filePath[2] === ':') {
    filePath = filePath.slice(1);
  }
  return platform === 'win32' ? path.win32.normalize(filePath) : filePath;
}

function registerFileHandlers(ipcMain, protocol, dialog, maybeWindowOrBackend, maybeBackend) {
  if (isRegistered) return;
  isRegistered = true;

  const BACKEND_URL = typeof maybeWindowOrBackend === 'string' ? maybeWindowOrBackend : maybeBackend;
  const targetWindow = typeof maybeWindowOrBackend === 'object' ? maybeWindowOrBackend : null;
  const getWindow = (event) => (event?.sender ? BrowserWindow.fromWebContents(event.sender) : null) || BrowserWindow.getFocusedWindow() || targetWindow;
  const handle = (channel, handler) => ipcMain.handle(channel, async (event, ...args) => {
    try { return await handler(event, ...args); }
    catch (error) {
      console.error(`Desktop action failed (${channel}):`, error.message);
      return { ok: false, canceled: false, error: error.message || 'The desktop action failed' };
    }
  });
  const readableFile = async filePath => {
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) throw new Error('Choose a valid file on disk');
    await fs.promises.access(filePath, fs.constants.R_OK);
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) throw new Error('The selected location is not a file');
    return stat;
  };

  // Local File Picker (Saves metadata via /localUpload instead of uploading blob)
  handle('open-local-file-dialog', async (event, token) => {
    const win = getWindow(event);
    const dialogOptions = {
      title: 'Select a Local Book',
      properties: ['openFile'],
      filters: [
        { name: 'Supported Books', extensions: ['pdf', 'epub', 'txt'] }
      ]
    };
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) return { ok: false, error: "Canceled" };

    const filePath = filePaths[0];
    const fileName = path.basename(filePath);

    try {
      const stat = await readableFile(filePath);
      const fileType = getDocumentType(fileName);
      if (!fileType) return { ok: false, error: 'Choose a PDF, EPUB, or TXT file' };
      // Send metadata to the backend to register the local file
      const response = await fetch(`${BACKEND_URL}/localUpload`, {
        signal: AbortSignal.timeout(15000),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileName,
          fileType,
          fileSize: stat.size,
          localId: filePath,
          fileUrl: toLocalUrl(filePath)
        })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) return { ok: false, status: response.status, error: data?.error || data?.message || 'Failed to register local file' };
      if (!data?.file?.fileUrl) return { ok: false, error: 'The server returned no local file location' };

      return { ok: true, data };
    } catch (err) {
      console.error('Local File Error:', err);
      return { ok: false, error: err.message };
    }
  });

  // Explicit native file picker for local files (prompts OS dialog & grants file access)
  handle('open-local-file', async (event) => {
    const win = getWindow(event);
    const dialogOptions = {
      title: 'Select a Local Book or Document',
      properties: ['openFile'],
      filters: [
        { name: 'Supported Books & Documents', extensions: ['pdf', 'epub', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    };
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = filePaths[0];
    const fileName = path.basename(filePath);

    try {
      const stat = await readableFile(filePath);
      const fileType = getDocumentType(fileName) || 'application/octet-stream';

      return {
        canceled: false,
        filePath,
        fileName,
        fileSize: stat.size,
        fileType,
        url: toLocalUrl(filePath)
      };
    } catch (err) {
      console.error('Permission check failed for selected file:', err);
      if (win) {
        dialog.showErrorBox(
          'File Permission Error',
          `Could not read ${fileName}: ${err.message}. Please check file permissions.`
        );
      }
      return { canceled: false, error: err.message };
    }
  });

  // Check file permission IPC handler
  handle('check-file-permission', async (event, filePath) => {
    try {
      await readableFile(extractPathFromLocalUrl(filePath));
      return { hasPermission: true };
    } catch (err) {
      return { hasPermission: false, error: err.message };
    }
  });

  // Batch check status (existence & permissions) for local file URLs
  handle('check-local-files-status', async (event, urls) => {
    if (!Array.isArray(urls)) return {};
    const results = {};
    for (const url of urls) {
      if (!url || typeof url !== 'string') continue;
      const isLocal =
        url.startsWith('mfr-local://') ||
        url.startsWith('local://') ||
        url.startsWith('file://') ||
        url.startsWith('/') ||
        /^[a-zA-Z]:[\\/]/.test(url) ||
        url.startsWith('\\\\');

      if (!isLocal) {
        results[url] = { exists: true, isLocal: false, readable: true, path: url };
        continue;
      }

      let filePath = url;
      try {
        filePath = extractPathFromLocalUrl(url);
        await readableFile(filePath);
        results[url] = { exists: true, isLocal: true, readable: true, path: filePath };
      } catch (err) {
        results[url] = {
          exists: err.code !== 'ENOENT' && err.code !== 'ENOTDIR',
          isLocal: true,
          readable: false,
          path: filePath,
          error: err.message,
        };
      }
    }
    return results;
  });

  // Relink a missing local file via native OS open dialog
  handle('relink-local-file', async (event, { oldUrl, originalFileName } = {}) => {
    const win = getWindow(event);
    let oldPath;
    try { oldPath = extractPathFromLocalUrl(oldUrl || ''); }
    catch { return { canceled: false, error: 'The original file location is invalid' }; }
    const ext = path.extname(oldPath || originalFileName || '').toLowerCase().replace(/^\./, '');

    const filters = [];
    if (ext === 'pdf') {
      filters.push({ name: 'PDF Documents (*.pdf)', extensions: ['pdf'] });
    } else if (ext === 'epub') {
      filters.push({ name: 'EPUB Books (*.epub)', extensions: ['epub'] });
    } else if (ext === 'txt') {
      filters.push({ name: 'Text Documents (*.txt)', extensions: ['txt'] });
    }
    filters.push(
      { name: 'Supported Books & Documents', extensions: ['pdf', 'epub', 'txt'] },
      { name: 'All Files', extensions: ['*'] }
    );

    const dialogTitle = originalFileName
      ? `Relink Media: Locate "${originalFileName}"`
      : 'Relink Missing Local File';

    const dialogOptions = {
      title: dialogTitle,
      properties: ['openFile'],
      filters,
    };

    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) {
      return { canceled: true };
    }

    const newPath = filePaths[0];
    const newFileName = path.basename(newPath);

    try {
      const stat = await readableFile(newPath);
      const newExt = path.extname(newPath).toLowerCase();
      if (ext && newExt !== `.${ext}`) return { canceled: false, error: 'Choose a file with the same format as the original document' };
      const fileType = getDocumentType(newFileName) || 'application/octet-stream';

      const formatSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.min(sizes.length - 1, Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      return {
        canceled: false,
        oldUrl,
        newUrl: toLocalUrl(newPath),
        newPath,
        fileName: newFileName,
        fileSize: formatSize(stat.size),
        rawSize: stat.size,
        fileType,
      };
    } catch (err) {
      console.error('Permission check failed for relinked file:', err);
      if (win) {
        dialog.showErrorBox(
          'File Permission Error',
          `Could not read ${newFileName}: ${err.message}. Please check file permissions.`
        );
      }
      return { canceled: false, error: err.message };
    }
  });

  // Native file picker and upload to backend (Cloud)
  handle('select-and-upload-file', async (event, token) => {
    const win = getWindow(event);
    const dialogOptions = {
      title: 'Select a File to Upload',
      properties: ['openFile'],
      filters: [
        { name: 'Supported Files', extensions: ['txt', 'pdf', 'epub'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    };
    const { canceled, filePaths } = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) return { canceled: true };

    try {
      const filePath = filePaths[0];
      const fileName = path.basename(filePath);
      const stat = await readableFile(filePath);
      if (!getDocumentType(fileName)) return { canceled: false, error: 'Choose a PDF, EPUB, or TXT file' };
      if (stat.size > MAX_FILE_SIZE) return { canceled: false, error: "Files must be 50 MB or smaller" };
      const fileBuffer = await fs.promises.readFile(filePath);
      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: getDocumentType(fileName) || 'application/octet-stream' });
      formData.append('UploadingFile', blob, fileName);
      const response = await fetch(`${BACKEND_URL}/fileUpload`, {
        signal: AbortSignal.timeout(120000),
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) return { canceled: false, status: response.status, error: data?.error || data?.message || 'Upload failed' };
      if (!data?.url) return { canceled: false, error: 'The server returned no document URL' };

      return { canceled: false, data };
    } catch (err) {
      console.error('File selection upload error:', err);
      return { canceled: false, error: err.message };
    }
  });

  // Handle drag-and-drop file upload (Cloud)
  handle('upload-dropped-file', async (event, { token, filePath } = {}) => {
    try {
      const stat = await readableFile(filePath);
      const fileName = path.basename(filePath);
      if (!getDocumentType(fileName)) return { ok: false, error: 'Choose a PDF, EPUB, or TXT file' };
      if (stat.size > MAX_FILE_SIZE) return { ok: false, error: "Files must be 50 MB or smaller" };
      const fileBuffer = await fs.promises.readFile(filePath);

      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: getDocumentType(fileName) || 'application/octet-stream' });
      formData.append('UploadingFile', blob, fileName);

      const response = await fetch(`${BACKEND_URL}/fileUpload`, {
        signal: AbortSignal.timeout(120000),
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        return { ok: false, status: response.status, error: data?.error || data?.message || 'Upload failed' };
      }
      if (!data?.url) return { ok: false, error: 'The server returned no document URL' };

      return { ok: true, data };
    } catch (err) {
      console.error('Drop upload error:', err);
      return { ok: false, error: err.message || 'Upload failed' };
    }
  });

  // Register secure protocol to read local files natively via absolute path
  protocol.handle('mfr-local', async (request) => {
    let filePath;
    try {
      filePath = extractPathFromLocalUrl(request.url);
      if (!path.isAbsolute(filePath) || filePath.includes('\0')) throw new Error('Invalid path');
    } catch {
      return new Response('Invalid local file URL', { status: 400 });
    }

    try {
      const stat = await fs.promises.stat(filePath);
      if (!stat.isFile()) return new Response('The location is not a file', { status: 400 });
      await fs.promises.access(filePath, fs.constants.R_OK);
      return await net.fetch(pathToFileURL(filePath).href, { method: request.method, headers: request.headers });
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
        return new Response('Media Offline: File not found on disk', { status: 404 });
      }
      console.error('[mfr-local] File permission error for path:', filePath, err);
      return new Response('File read permission denied', {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

  });
}

module.exports = { registerFileHandlers, extractPathFromLocalUrl };
