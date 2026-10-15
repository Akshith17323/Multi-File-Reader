const fs = require('fs');
const path = require('path');
const { net, BrowserWindow } = require('electron');

let isRegistered = false;

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
          localId: filePath
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
      throw err;
    }
  });

  // Handle drag-and-drop file upload (Cloud)
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

  // Register secure protocol to read local files natively via absolute path
  protocol.handle('mfr-local', (request) => {
    // Decode the path. URL format: mfr-local://[absolute-path]
    // Because of standard URL parsing, the path might start with an extra slash.
    let filePath = decodeURIComponent(request.url.slice('mfr-local://'.length));
    
    // Handle Windows paths like /C:/...
    if (process.platform === 'win32' && filePath.startsWith('/')) {
      filePath = filePath.slice(1);
    }
    
    return net.fetch('file://' + filePath);
  });
}

module.exports = { registerFileHandlers };
