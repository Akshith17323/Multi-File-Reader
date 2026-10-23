const fs = require('fs');
const path = require('path');
const { pathToFileURL, fileURLToPath } = require('url');
const { getDocumentType, MAX_FILE_SIZE, toLocalUrl } = require('../../server/src/utils/fileTypes');
const { net, BrowserWindow } = require('electron');

let isRegistered = false;

function extractPathFromLocalUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let filePath = rawUrl;
  if (filePath.startsWith('mfr-local://')) {
    filePath = decodeURIComponent(filePath.replace(/^mfr-local:\/\//, ''));
  } else if (filePath.startsWith('file://')) {
    filePath = fileURLToPath(filePath);
  } else if (filePath.startsWith('local://')) {
    filePath = filePath.slice(8);
  }
  if (process.platform === 'win32' && filePath.startsWith('/') && filePath[2] === ':') {
    filePath = filePath.slice(1);
  }
  return filePath;
}

function registerFileHandlers(ipcMain, protocol, dialog, maybeWindowOrBackend, maybeBackend) {
  if (isRegistered) return;
  isRegistered = true;

  const BACKEND_URL = typeof maybeWindowOrBackend === 'string' ? maybeWindowOrBackend : maybeBackend;
  const targetWindow = typeof maybeWindowOrBackend === 'object' ? maybeWindowOrBackend : null;
  const getWindow = (event) => (event?.sender ? BrowserWindow.fromWebContents(event.sender) : null) || BrowserWindow.getFocusedWindow() || targetWindow;

  // Local File Picker (Saves metadata via /localUpload instead of uploading blob)
  ipcMain.handle('open-local-file-dialog', async (event, token) => {
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
      fs.accessSync(filePath, fs.constants.R_OK);
      const stat = fs.statSync(filePath);
      const fileType = getDocumentType(fileName);
      // Send metadata to the backend to register the local file
      const response = await fetch(`${BACKEND_URL}/localUpload`, {
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

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || 'Failed to register local file');

      return { ok: true, data };
    } catch (err) {
      console.error('Local File Error:', err);
      return { ok: false, error: err.message };
    }
  });

  // Explicit native file picker for local files (prompts OS dialog & grants file access)
  ipcMain.handle('open-local-file', async (event) => {
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
      fs.accessSync(filePath, fs.constants.R_OK);
      const stat = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
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
  ipcMain.handle('check-file-permission', async (event, filePath) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { hasPermission: false, error: 'File does not exist' };
      }
      fs.accessSync(filePath, fs.constants.R_OK);
      return { hasPermission: true };
    } catch (err) {
      return { hasPermission: false, error: err.message };
    }
  });

  // Batch check status (existence & permissions) for local file URLs
  ipcMain.handle('check-local-files-status', async (event, urls) => {
    if (!Array.isArray(urls)) return {};
    const results = {};
    for (const url of urls) {
      if (!url || typeof url !== 'string') continue;
      const isLocal =
        url.startsWith('mfr-local://') ||
        url.startsWith('local://') ||
        url.startsWith('file://') ||
        url.startsWith('/') ||
        /^[a-zA-Z]:[\\/]/.test(url);

      if (!isLocal) {
        results[url] = { exists: true, isLocal: false, readable: true, path: url };
        continue;
      }

      const filePath = extractPathFromLocalUrl(url);
      try {
        if (!fs.existsSync(filePath)) {
          results[url] = {
            exists: false,
            isLocal: true,
            readable: false,
            path: filePath,
            error: 'File not found at specified path (Media Offline)',
          };
        } else {
          fs.accessSync(filePath, fs.constants.R_OK);
          results[url] = { exists: true, isLocal: true, readable: true, path: filePath };
        }
      } catch (err) {
        results[url] = {
          exists: true,
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
  ipcMain.handle('relink-local-file', async (event, { oldUrl, originalFileName } = {}) => {
    const win = getWindow(event);
    const oldPath = extractPathFromLocalUrl(oldUrl || '');
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
      fs.accessSync(newPath, fs.constants.R_OK);
      const stat = fs.statSync(newPath);
      const newExt = path.extname(newPath).toLowerCase();
      if (ext && newExt !== `.${ext}`) return { canceled: false, error: 'Choose a file with the same format as the original document' };
      const fileType = getDocumentType(newFileName) || 'application/octet-stream';

      const formatSize = (bytes) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
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
  ipcMain.handle('select-and-upload-file', async (event, token) => {
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

    const filePath = filePaths[0];
    const fileName = path.basename(filePath);
    if (fs.statSync(filePath).size > MAX_FILE_SIZE) return { canceled: false, error: "Files must be 50 MB or smaller" };
    const fileBuffer = fs.readFileSync(filePath);

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: getDocumentType(fileName) || 'application/octet-stream' });
    formData.append('UploadingFile', blob, fileName);

    try {
      const response = await fetch(`${BACKEND_URL}/fileUpload`, {
        signal: AbortSignal.timeout(120000),
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || 'Upload failed');

      return { canceled: false, data };
    } catch (err) {
      console.error('File selection upload error:', err);
      return { canceled: false, error: err.message };
    }
  });

  // Handle drag-and-drop file upload (Cloud)
  ipcMain.handle('upload-dropped-file', async (event, { token, filePath }) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) {
        return { ok: false, error: 'File does not exist on disk' };
      }

      const fileName = path.basename(filePath);
      if (fs.statSync(filePath).size > MAX_FILE_SIZE) return { ok: false, error: "Files must be 50 MB or smaller" };
      const fileBuffer = fs.readFileSync(filePath);

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

      const data = await response.json();
      if (!response.ok) {
        return { ok: false, status: response.status, error: data.error || data.message || 'Upload failed' };
      }

      return { ok: true, data };
    } catch (err) {
      console.error('Drop upload error:', err);
      return { ok: false, error: err.message || 'Upload failed' };
    }
  });

  // Register secure protocol to read local files natively via absolute path
  protocol.handle('mfr-local', async (request) => {
    const filePath = extractPathFromLocalUrl(request.url);

    if (!fs.existsSync(filePath)) {
      console.warn('[mfr-local] Media offline - file not found at:', filePath);
      return new Response('Media Offline: File not found on disk', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch (err) {
      console.error('[mfr-local] File permission error for path:', filePath, err);
      return new Response('File read permission denied', {
        status: 403,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return net.fetch(pathToFileURL(filePath).href);
  });
}

module.exports = { registerFileHandlers, extractPathFromLocalUrl };
