const { app, BrowserWindow, ipcMain, dialog, protocol, net } = require('electron');
const path = require('path');
const { registerFileHandlers } = require('./adapters/FileHandlerAdapter');
const { registerApiProxy } = require('./services/ApiProxyService');

const BACKEND_URL = 'http://localhost:2007';

let isInitialized = false;

function setupAppHandlers() {
  if (isInitialized) return;
  isInitialized = true;

  // Window control handlers that work with any active BrowserWindow
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

  // Independent Services
  registerApiProxy(ipcMain, BACKEND_URL);
  registerFileHandlers(ipcMain, protocol, dialog, BACKEND_URL);
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
  mainWindow.loadURL('http://localhost:3000');
  return mainWindow;
}

app.whenReady().then(() => {
  setupAppHandlers();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
