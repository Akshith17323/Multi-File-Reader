const path = require('node:path');
const { utilityProcess } = require('electron');

// Keep a stable origin so local library entries/bookmarks survive app restarts.
const READER_PORT = 17767;

function startPackagedWebServer(onFailure) {
  const directory = path.join(process.resourcesPath, 'web/standalone/apps/web');
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    HOSTNAME: '127.0.0.1',
    PORT: String(READER_PORT),
    NEXT_TELEMETRY_DISABLED: '1',
  };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = utilityProcess.fork(path.join(directory, 'server.js'), [], {
    cwd: directory, env, stdio: 'pipe', serviceName: 'MultiReader Web',
  });
  let stopping = false;
  child.stdout?.on('data', data => console.log(`[Reader] ${data.toString().trimEnd()}`));
  child.stderr?.on('data', data => console.error(`[Reader] ${data.toString().trimEnd()}`));
  child.once('exit', code => {
    if (!stopping) onFailure(new Error(`The bundled reader server stopped (exit ${code}). Port ${READER_PORT} may already be in use.`));
  });
  return {
    url: `http://127.0.0.1:${READER_PORT}`,
    stop() { stopping = true; child.kill(); },
  };
}

module.exports = { startPackagedWebServer };
