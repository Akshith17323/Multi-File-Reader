// Main process: owns the desktop window, native actions, and IPC handlers.
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  shell,
  net,
} = require('electron');
const path = require('path');
const { registerFileHandlers } = require('./adapters/FileHandlerAdapter');
const { registerApiProxy } = require('./services/ApiProxyService');

// The frontend is displayed in BrowserWindow. The backend serves HTTP API requests.
const FRONTEND_URL = readServerUrl(
  process.env.ELECTRON_FRONTEND_URL,
  'http://localhost:3000',
);
const BACKEND_URL = readServerUrl(
  process.env.ELECTRON_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL,
  'http://localhost:2007',
);
const FRONTEND_ORIGIN = new URL(FRONTEND_URL).origin;
const STARTUP_TIMEOUT_MS = 30000;
const REQUEST_TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 1000;

// Track each window's startup requests so closing it also cancels pending work.
const windowStates = new Map();
let ipcHandlersRegistered = false;

// Register before app.whenReady(): readers fetch local documents through this scheme.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'mfr-local',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    frame: false, // React renders the custom titlebar and its window buttons.
    backgroundColor: '#101014',
    title: 'MultiReader',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: [
        `--mfr-backend-url=${encodeURIComponent(BACKEND_URL)}`,
      ],
      nodeIntegration: false, // React cannot call Node.js directly.
      contextIsolation: true, // Preload and the page have separate JS contexts.
      sandbox: true,
    },
  });

  windowStates.set(mainWindow, { loading: false, statusUrl: null });
  configureNavigation(mainWindow);
  registerWindowEvents(mainWindow);

  // The web server may still be starting when Electron opens.
  void loadFrontend(mainWindow);
  return mainWindow;
}

function registerIpcHandlers() {
  if (ipcHandlersRegistered) return;
  ipcHandlersRegistered = true;

  // send() in preload pairs with ipcMain.on(): these actions need no reply.
  ipcMain.on('window-minimize', event => {
    const mainWindow = getTrustedWindow(event, true);
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', event => {
    const mainWindow = getTrustedWindow(event, true);
    if (!mainWindow) return;

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('window-close', event => {
    const mainWindow = getTrustedWindow(event, true);
    if (mainWindow) mainWindow.close();
  });

  ipcMain.on('app-retry', event => {
    const mainWindow = getTrustedWindow(event, true);
    if (!mainWindow) return;

    const state = windowStates.get(mainWindow);
    if (event.senderFrame.url === state.statusUrl) {
      void loadFrontend(mainWindow);
    }
  });

  // invoke() in preload pairs with ipcMain.handle(): return values become replies.
  ipcMain.handle('get-version', event => {
    if (!getTrustedWindow(event, true)) return null;
    return app.getVersion();
  });

  ipcMain.handle('get-window-state', event => {
    const mainWindow = getTrustedWindow(event, true);
    return { maximized: mainWindow ? mainWindow.isMaximized() : false };
  });

  // The existing API and file modules use this wrapper to check every IPC sender.
  // They receive an object with the same handle(channel, handler) interface as ipcMain.
  const trustedIpc = {
    handle(channel, handler) {
      ipcMain.handle(channel, (event, ...args) => {
        if (!getTrustedWindow(event)) {
          return { ok: false, error: 'Desktop action is unavailable from this page' };
        }

        return handler(event, ...args);
      });
    },
  };

  registerApiProxy(trustedIpc, BACKEND_URL);
  registerFileHandlers(trustedIpc, protocol, dialog, BACKEND_URL);
}

function registerWindowEvents(mainWindow) {
  let lastMaximized;

  // Main -> preload -> React: publish window state when it changes.
  const sendWindowState = () => {
    if (mainWindow.isDestroyed()) return;

    const maximized = mainWindow.isMaximized();
    if (maximized === lastMaximized) return;

    lastMaximized = maximized;
    mainWindow.webContents.send('window-state-changed', { maximized });
  };

  mainWindow.on('maximize', sendWindowState);
  mainWindow.on('unmaximize', sendWindowState);
  // Frameless windows on macOS can emit resize without maximize/unmaximize.
  mainWindow.on('resize', sendWindowState);

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, _description, url, isMainFrame) => {
      const state = windowStates.get(mainWindow);
      const navigationCanceled = errorCode === -3;

      if (isMainFrame && !navigationCanceled && isFrontend(url) && !state?.loading) {
        void showStartupPage(mainWindow, true);
      }
    },
  );

  mainWindow.on('closed', () => {
    const state = windowStates.get(mainWindow);
    state.startupController?.abort();
    clearTimeout(state.retryTimer);
    state.resumeRetry?.();
    windowStates.delete(mainWindow);
  });
}

function configureNavigation(mainWindow) {
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Google OAuth needs an isolated popup with its opener to return the login result.
    if (isGoogleAuth(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          frame: true,
          webPreferences: {
            preload: '',
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        },
      };
    }

    openExternalLink(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-create-window', childWindow => {
    childWindow.webContents.setWindowOpenHandler(({ url }) => {
      openExternalLink(url);
      return { action: 'deny' };
    });

    childWindow.webContents.on('will-navigate', (event, url) => {
      if (!isFrontend(url) && !isGoogleAuth(url)) {
        event.preventDefault();
        openExternalLink(url);
      }
    });
  });

  // Keep the desktop window on our frontend; send external links to the OS browser.
  const guardNavigation = (event, url) => {
    const state = windowStates.get(mainWindow);
    if (isFrontend(url) || url === state?.statusUrl) return;

    event.preventDefault();
    openExternalLink(url);
  };

  mainWindow.webContents.on('will-navigate', guardNavigation);
  mainWindow.webContents.on('will-redirect', guardNavigation);
}

function getTrustedWindow(event, allowStartupPage = false) {
  const mainWindow = BrowserWindow.fromWebContents(event.sender);
  const state = windowStates.get(mainWindow);

  // Only our window's main frame can use the desktop bridge.
  if (!state || event.senderFrame !== event.sender.mainFrame) return null;

  const senderUrl = event.senderFrame.url;
  if (isFrontend(senderUrl)) return mainWindow;

  // The built-in startup page only needs window controls, version, and retry.
  if (allowStartupPage && senderUrl === state.statusUrl) return mainWindow;

  return null;
}

function readServerUrl(value, fallback) {
  const url = new URL(value || fallback);
  const usesHttp = ['http:', 'https:'].includes(url.protocol);

  if (!usesHttp || url.username || url.password) {
    throw new Error('Desktop server URLs must use HTTP or HTTPS without credentials');
  }

  return url.href.replace(/\/$/, '');
}

function isFrontend(url) {
  try {
    return new URL(url).origin === FRONTEND_ORIGIN;
  } catch {
    return false;
  }
}

function isGoogleAuth(url) {
  try {
    return new URL(url).origin === 'https://accounts.google.com';
  } catch {
    return false;
  }
}

function openExternalLink(url) {
  try {
    const protocol = new URL(url).protocol;
    if (!['http:', 'https:', 'mailto:'].includes(protocol)) return;

    shell.openExternal(url).catch(error => {
      console.error('Could not open link:', error.message);
    });
  } catch {
    // A malformed URL should not crash the desktop app.
  }
}

// Startup recovery: display a small page until Next.js is ready, then load the app.
async function loadFrontend(mainWindow) {
  const state = windowStates.get(mainWindow);
  if (!state || state.loading || mainWindow.isDestroyed()) return;

  state.loading = true;

  try {
    await showStartupPage(mainWindow);
    const deadline = Date.now() + STARTUP_TIMEOUT_MS;

    while (!mainWindow.isDestroyed() && Date.now() < deadline) {
      try {
        state.startupController = new AbortController();
        const response = await net.fetch(FRONTEND_URL, {
          cache: 'no-store',
          signal: AbortSignal.any([
            state.startupController.signal,
            AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          ]),
        });

        // This is an availability check; BrowserWindow loads the actual page next.
        await response.body?.cancel();
        if (!response.ok) {
          throw new Error(`Web server returned ${response.status}`);
        }

        if (mainWindow.isDestroyed()) return;

        await mainWindow.loadURL(FRONTEND_URL);
        state.statusUrl = null;
        return;
      } catch {
        if (mainWindow.isDestroyed()) return;

        await new Promise(resolve => {
          state.resumeRetry = resolve;
          state.retryTimer = setTimeout(resolve, RETRY_DELAY_MS);
        });
        state.resumeRetry = null;
      }
    }

    if (!mainWindow.isDestroyed()) {
      await showStartupPage(mainWindow, true);
    }
  } finally {
    state.loading = false;
    state.startupController = null;
  }
}

async function showStartupPage(mainWindow, unavailable = false) {
  const state = windowStates.get(mainWindow);
  if (!state || mainWindow.isDestroyed()) return;

  const title = unavailable ? 'Unable to connect' : 'Starting MultiReader…';
  const message = unavailable
    ? 'The app could not reach its web server. Start the server or check your connection, then retry.'
    : 'Waiting for the app to become available. This can take a moment while the server starts.';
  const retryButton = unavailable
    ? `<button onclick="this.disabled=true;window.electronAPI.send('app-retry')">Retry</button>`
    : '';

  // Inline HTML keeps startup recovery available even when the frontend is offline.
  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>MultiReader</title>
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
    <style>
      body { margin: 0; background: #101014; color: #eee; font: 16px system-ui; }
      header {
        height: 36px; -webkit-app-region: drag; display: flex;
        align-items: center; justify-content: space-between; padding: 0 16px;
      }
      button {
        -webkit-app-region: no-drag; cursor: pointer; border: 1px solid #555;
        border-radius: 8px; background: #24242c; color: white; padding: 10px 16px;
      }
      header button { padding: 4px 12px; }
      main { max-width: 480px; margin: 18vh auto; padding: 24px; }
      p { color: #b8b8c4; line-height: 1.6; }
    </style>
  </head>
  <body>
    <header>
      MultiReader
      <button aria-label="Close window" onclick="window.electronAPI.send('window-close')">×</button>
    </header>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
      ${retryButton}
    </main>
  </body>
</html>`;

  state.statusUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

  try {
    await mainWindow.loadURL(state.statusUrl);
  } catch (error) {
    if (!mainWindow.isDestroyed()) {
      console.error('Could not display startup status:', error.message);
    }
  }
}

// App lifecycle: initialize IPC once and recreate the window when reopened on macOS.
app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch(error => {
  console.error('Desktop startup failed:', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
