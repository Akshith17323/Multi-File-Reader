const { contextBridge, ipcRenderer, webUtils } = require('electron');

const VALID_INVOKE_CHANNELS = [
  'get-version',
  'select-and-upload-file',
  'api-request',
  'upload-dropped-file',
  'open-local-file-dialog',
  'open-local-file',
  'check-file-permission',
  'check-local-files-status',
  'relink-local-file'
];

const VALID_SEND_CHANNELS = [
  'window-minimize',
  'window-maximize',
  'window-close'
];

const VALID_EVENT_CHANNELS = [
  'window-maximized-state'
];

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => {
    if (VALID_INVOKE_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Unauthorized or invalid IPC invoke channel: ${channel}`));
  },
  send: (channel, ...args) => {
    if (VALID_SEND_CHANNELS.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else {
      console.warn(`Unauthorized or invalid IPC send channel: ${channel}`);
    }
  },
  on: (channel, func) => {
    if (VALID_EVENT_CHANNELS.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  removeListener: (channel, func) => {
    if (VALID_EVENT_CHANNELS.includes(channel)) {
      ipcRenderer.removeListener(channel, func);
    }
  },
  getFilePath: (file) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function' && file) {
        return webUtils.getPathForFile(file);
      }
      return file?.path || '';
    } catch (err) {
      console.warn('Failed to resolve file path via webUtils:', err);
      return file?.path || '';
    }
  }
});

