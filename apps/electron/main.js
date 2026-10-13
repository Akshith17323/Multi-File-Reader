const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require('electron');
const path = require('path');
const { registerFileHandlers } = require('./adapters/FileHandlerAdapter');
const { registerApiProxy } = require('./services/ApiProxyService');

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

  // --- Core Window Handlers ---
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

  // --- Independent Services ---
  registerApiProxy(ipcMain, BACKEND_URL);
  registerFileHandlers(ipcMain, protocol, dialog, mainWindow, BACKEND_URL);
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
