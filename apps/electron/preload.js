// Preload runs before React and exposes a limited desktop API to the page.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Request/reply: ipcRenderer.invoke() -> ipcMain.handle().
const invokeChannels = new Set([
  'get-version',
  'get-window-state',
  'api-request',
  'select-and-upload-file',
  'upload-dropped-file',
  'open-local-file-dialog',
  'open-local-file',
  'open-local-files',
  'open-local-folder',
  'check-file-permission',
  'check-local-files-status',
  'relink-local-file',
]);

// One-way actions: ipcRenderer.send() -> ipcMain.on().
const sendChannels = new Set([
  'window-minimize',
  'window-maximize',
  'window-close',
  'app-retry',
]);

// Notifications: webContents.send() -> ipcRenderer.on().
const eventChannels = new Set(['window-state-changed']);

// main.js passes this public URL through BrowserWindow.additionalArguments.
const backendUrlPrefix = '--mfr-backend-url=';
const backendArgument = process.argv.find(argument => {
  return argument.startsWith(backendUrlPrefix);
});
const backendUrl = backendArgument
  ? decodeURIComponent(backendArgument.slice(backendUrlPrefix.length))
  : undefined;

// React accesses these methods as window.electronAPI.
// Expose wrappers instead of giving the page the complete ipcRenderer object.
contextBridge.exposeInMainWorld('electronAPI', {
  backendUrl,
  platform: process.platform,

  invoke(channel, ...args) {
    if (!invokeChannels.has(channel)) {
      return Promise.reject(new Error(`Unsupported desktop action: ${channel}`));
    }

    return ipcRenderer.invoke(channel, ...args);
  },

  send(channel, ...args) {
    if (!sendChannels.has(channel)) return;

    ipcRenderer.send(channel, ...args);
  },

  on(channel, callback) {
    if (!eventChannels.has(channel) || typeof callback !== 'function') return;

    // Hide Electron's event object; React only receives the payload.
    const listener = (_event, ...args) => {
      callback(...args);
    };
    ipcRenderer.on(channel, listener);

    // React calls this cleanup on unmount. Keep the original listener here,
    // because callback identity can change when crossing contextBridge.
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },

  getFilePath(file) {
    // Convert a file selected or dropped in React into its native disk path.
    return webUtils.getPathForFile(file);
  },
});
