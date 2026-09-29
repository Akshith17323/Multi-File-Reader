const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const BACKEND_URL = 'http://localhost:2007';

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
  mainWindow.loadURL('http://localhost:3000');
  
  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  // IPC Handlers
  ipcMain.on('window-minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    mainWindow.close();
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
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
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
      throw err;
    }
  });

  // Handle drag-and-drop file upload
  ipcMain.handle('upload-dropped-file', async (event, { token, filePath }) => {
    if (!fs.existsSync(filePath)) {
      throw new Error('File does not exist on disk');
    }

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
      
      return { ok: true, data };
    } catch (err) {
      console.error('Drop upload error:', err);
      throw err;
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
