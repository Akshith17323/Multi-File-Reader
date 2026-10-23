let isRegistered = false;

function registerApiProxy(ipcMain, backendUrl) {
  if (isRegistered) return;
  isRegistered = true;

  // React invokes 'api-request'; main performs HTTP and returns the server response.
  ipcMain.handle('api-request', async (event, options) => {
    try {
      const { endpoint, method = 'GET', headers = {}, body } = options || {};
      if (typeof endpoint !== 'string' || !endpoint.startsWith('/') || endpoint.startsWith('//')) {
        return { ok: false, status: 400, error: 'Invalid API endpoint' };
      }

      const target = new URL(`${backendUrl}${endpoint}`);
      if (target.origin !== new URL(backendUrl).origin) {
        return { ok: false, status: 400, error: 'Invalid API endpoint' };
      }

      const response = await fetch(target.href, {
        method,
        signal: AbortSignal.timeout(15000),
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
      return { ok: false, status: 0, error: error.message };
    }
  });
}

module.exports = { registerApiProxy };
