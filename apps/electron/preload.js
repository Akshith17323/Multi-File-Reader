const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel, ...args) => {
    const validChannels = ['get-version', 'select-and-upload-file', 'api-request', 'upload-dropped-file', 'open-local-file-dialog', 'open-local-file', 'check-file-permission', 'check-local-files-status', 'relink-local-file'];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Unsupported desktop action: ${channel}`));
  },
  getFilePath: (file) => webUtils.getPathForFile(file),
  send: (channel, ...args) => {
    let validChannels = ['window-minimize', 'window-maximize', 'window-close'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    }
  },
  on: (channel, func) => {
    let validChannels = [];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  removeListener: (channel, func) => {
    let validChannels = [];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, func);
    }
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency])
  }
})
