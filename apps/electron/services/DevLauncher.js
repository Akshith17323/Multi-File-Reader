// Start the desktop app with one frontend and one backend. Reuse healthy servers.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '../../..');

async function serverStatus(url, backend = false) {
  try {
    const response = await fetch(new URL(backend ? '/files' : '/', url), {
      signal: AbortSignal.timeout(2000),
    });
    await response.body?.cancel();
    return { reachable: true, healthy: backend ? response.status === 401 : response.ok };
  } catch {
    return { reachable: false, healthy: false };
  }
}

function desktopEnvironment(env) {
  const result = { ...env };
  // Codex and some terminals set this for Node tools; Electron needs its GUI mode.
  delete result.ELECTRON_RUN_AS_NODE;
  return result;
}

function readLocalEnvironment(filename) {
  return fs.existsSync(filename) ? dotenv.parse(fs.readFileSync(filename)) : {};
}

async function launch(desktopOnly = false) {
  const serverEnv = readLocalEnvironment(path.join(root, 'apps/server/.env'));
  const backendPort = process.env.PORT || serverEnv.PORT || '2007';
  const frontendUrl = process.env.ELECTRON_FRONTEND_URL || 'http://localhost:3000';
  const backendUrl = process.env.ELECTRON_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || `http://localhost:${backendPort}`;
  const children = new Set();
  const controller = new AbortController();
  let stopping = false;

  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    controller.abort();
    process.exitCode = code;
    for (const child of children) {
      if (child.exitCode !== null) continue;
      try {
        // Stop only processes this launcher started, including watcher children.
        if (process.platform === 'win32') child.kill('SIGTERM');
        else process.kill(-child.pid, 'SIGTERM');
      } catch { /* The process already exited. */ }
    }
  }

  function start(command, args, cwd, env, label) {
    console.log(`[${label}] Starting`);
    const child = spawn(command, args, { cwd, env, stdio: 'inherit', detached: process.platform !== 'win32' });
    children.add(child);
    child.once('error', error => { console.error(`[${label}] ${error.message}`); stop(1); });
    child.once('exit', code => {
      children.delete(child);
      if (!stopping) {
        if (label !== 'ELECTRON') console.error(`[${label}] Server exited; desktop startup stopped.`);
        stop(label === 'ELECTRON' ? code || 0 : 1);
      }
    });
    return child;
  }

  async function ensureServer(url, backend) {
    const label = backend ? 'SERVER' : 'WEB';
    const target = new URL(url);
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
      throw new Error('Desktop server URLs must use HTTP or HTTPS without credentials');
    }
    const status = await serverStatus(url, backend);
    if (status.healthy) {
      console.log(`[${label}] Reusing ${target.origin}`);
      return;
    }
    if (status.reachable) throw new Error(`${label} at ${target.origin} is unhealthy. Restart that server before launching Electron.`);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) {
      throw new Error(`${label} at ${target.origin} is unavailable.`);
    }
    if (backend) {
      start(process.execPath, [require.resolve('nodemon/bin/nodemon.js'), 'src/server.js'], path.join(root, 'apps/server'), {
        ...process.env, PORT: target.port || (target.protocol === 'https:' ? '443' : '80'),
      }, label);
    } else {
      const lockPath = path.join(root, 'apps/web/.next/dev/lock');
      try {
        const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
        process.kill(lock.pid, 0);
        throw new Error(`This project's web server is already running on port ${lock.port}. Set ELECTRON_FRONTEND_URL to ${lock.appUrl} or stop PID ${lock.pid}.`);
      } catch (error) {
        if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error;
      }
      start(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--port', target.port || '3000'], path.join(root, 'apps/web'), process.env, label);
    }
    const deadline = Date.now() + 60000;
    while (!controller.signal.aborted && Date.now() < deadline) {
      if ((await serverStatus(url, backend)).healthy) return;
      await delay(250, undefined, { signal: controller.signal });
    }
    throw new Error(`${label} did not become ready at ${target.origin}.`);
  }

  process.once('SIGINT', () => stop());
  process.once('SIGTERM', () => stop());
  try {
    if (!desktopOnly) {
      await ensureServer(backendUrl, true);
      await ensureServer(frontendUrl, false);
    }
    if (!stopping) start(require('electron'), [path.join(root, 'apps/electron')], root, desktopEnvironment({
      ...process.env, ELECTRON_FRONTEND_URL: frontendUrl, ELECTRON_BACKEND_URL: backendUrl,
    }), 'ELECTRON');
  } catch (error) {
    if (!stopping) console.error(error.message);
    stop(1);
  }
}

if (require.main === module) void launch(process.argv.includes('--desktop-only'));
module.exports = { serverStatus, desktopEnvironment };
