const fs = require('fs');
const path = require('path');
const { net, BrowserWindow } = require('electron');

let isRegistered = false;

function extractPathFromLocalUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let filePath = rawUrl;
  if (filePath.startsWith('mfr-local://')) {
    filePath = decodeURIComponent(filePath.replace(/^mfr-local:\/\//, ''));
  } else if (filePath.startsWith('file://')) {
    filePath = decodeURIComponent(filePath.replace(/^file:\/\//, ''));
  } else {
    filePath = decodeURIComponent(filePath);
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
        { name: 'Supported Books', extensions: ['pdf', 'epub'] }
      ]
    };
    const { canceled, filePaths } = win 
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (canceled || filePaths.length === 0) return { ok: false, error: "Canceled" };

    const filePath = filePaths[0];
    const fileName = path.basename(filePath);
    
    // Quick stat for file size
    const stat = fs.statSync(filePath);
    
    // Guess mime type
    let fileType = 'application/octet-stream';
    if (filePath.endsWith('.pdf')) fileType = 'application/pdf';
    else if (filePath.endsWith('.epub')) fileType = 'application/epub+zip';

    try {
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
          fileUrl: `mfr-local://${filePath}`
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
      let fileType = 'text/plain';
      if (ext === '.pdf') fileType = 'application/pdf';
      else if (ext === '.epub') fileType = 'application/epub+zip';

      return {
        canceled: false,
        filePath,
        fileName,
        fileSize: stat.size,
        fileType,
        url: `mfr-local://${filePath}`
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
      let fileType = 'text/plain';
      if (newExt === '.pdf') fileType = 'application/pdf';
      else if (newExt === '.epub') fileType = 'application/epub+zip';

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
        newUrl: `mfr-local://${newPath}`,
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
    const fileBuffer = fs.readFileSync(filePath);
    
    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append('UploadingFile', blob, fileName);

    try {
      const response = await fetch(`${BACKEND_URL}/fileUpload`, {
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
      const fileBuffer = fs.readFileSync(filePath);
      
      const formData = new FormData();
      const blob = new Blob([fileBuffer]);
      formData.append('UploadingFile', blob, fileName);

      const response = await fetch(`${BACKEND_URL}/fileUpload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        return { ok: false, error: data.error || data.message || 'Upload failed' };
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

    return net.fetch('file://' + filePath);
  });
}

module.exports = { registerFileHandlers, extractPathFromLocalUrl };
