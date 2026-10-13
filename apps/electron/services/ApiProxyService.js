function registerApiProxy(ipcMain, BACKEND_URL) {
  // Universal API proxy for Electron to bypass CORS
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
}

module.exports = { registerApiProxy };
