const { app, BrowserWindow, ipcMain, dialog, protocol, net, session } = require('electron');
const path = require('path');
const fs = require('fs');

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:2007';

// Register custom secure protocol for local files BEFORE app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mfr-local',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: true,
    },
  },
]);

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

let isInitialized = false;

function setupAppHandlers() {
  if (isInitialized) return;
  isInitialized = true;

  // Handle native local file requests via custom protocol mfr-local://
  protocol.handle('mfr-local', async (request) => {
    const filePath = extractPathFromLocalUrl(request.url);

    // If file does not exist on disk (moved/renamed/deleted), return 404
    if (!fs.existsSync(filePath)) {
      console.warn('[mfr-local] Media offline - file not found at:', filePath);
      return new Response('Media Offline: File not found on disk', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Verify read permission
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

  // Explicit native file picker for local files (prompts OS dialog & grants file access)
  ipcMain.handle('open-local-file', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Select a Local Book or Document',
      properties: ['openFile'],
      filters: [
        { name: 'Supported Books & Documents', extensions: ['pdf', 'epub', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = filePaths[0];
    const fileName = path.basename(filePath);
    
    // Check permission
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

  // Relink a missing local file via native OS open dialog (DaVinci Resolve style)
  ipcMain.handle('relink-local-file', async (event, { oldUrl, originalFileName } = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
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

    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: dialogTitle,
      properties: ['openFile'],
      filters,
    });

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

  // Window Controls
  ipcMain.on('window-minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    if (win) win.minimize();
  });

  ipcMain.on('window-maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    if (win) win.close();
  });

  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });

  // Universal API proxy for Electron
  ipcMain.handle('api-request', async (event, { endpoint, method = 'GET', headers = {}, body }) => {
    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      
      const data = await response.json().catch(() => null);
      
      return {
        ok: response.ok,
        status: response.status,
        data,
      };
    } catch (error) {
      console.error('IPC proxy error:', error);
      return { ok: false, error: error.message };
    }
  });

  // Native file picker and upload to backend
  ipcMain.handle('select-and-upload-file', async (event, token) => {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow();
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Select a File to Upload',
      properties: ['openFile'],
      filters: [
        { name: 'Supported Files', extensions: ['txt', 'pdf', 'epub'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

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

  // Handle drag-and-drop file upload
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
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the Next.js dev server during development
  // Note: in production, you'd load a static file instead.
  mainWindow.loadURL(process.env.FRONTEND_URL || 'http://localhost:3000');
  return mainWindow;
}

app.whenReady().then(() => {
  // Configure default session permissions
  if (session && session.defaultSession) {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(true);
    });
  }

  setupAppHandlers();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
