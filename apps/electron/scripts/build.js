const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const dotenv = require('dotenv');

const root = path.resolve(__dirname, '../../..');
const config = require(path.join(root, 'package.json')).build;
const productionEnvPath = path.join(root, 'apps/electron/.env.production');
const productionEnv = fs.existsSync(productionEnvPath)
  ? dotenv.parse(fs.readFileSync(productionEnvPath))
  : {};

function getBackendUrl() {
  const url = new URL(
    process.env.ELECTRON_BACKEND_URL
      || productionEnv.ELECTRON_BACKEND_URL
      || config.extraMetadata.desktop.backendUrl,
  );
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('ELECTRON_BACKEND_URL must be an HTTP(S) URL without credentials');
  }
  return url.href.replace(/\/$/, '');
}

function run(script, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: root, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Build command exited with ${code}`)));
  });
}

async function buildReader() {
  const web = path.join(root, 'apps/web');
  const env = {
    ...productionEnv,
    ...process.env,
    MFR_DESKTOP_BUILD: '1',
    NEXT_PUBLIC_BACKEND_URL: getBackendUrl(),
    NEXT_TELEMETRY_DISABLED: '1',
  };
  // Build the same web UI used in development, with its production runtime.
  await run(require.resolve('next/dist/bin/next'), ['build', web], env);
  const standalone = path.join(web, '.next/standalone');
  const bundledWeb = path.join(standalone, 'apps/web');
  if (!fs.existsSync(path.join(bundledWeb, 'server.js'))) {
    throw new Error('The standalone web server was not generated');
  }
  fs.cpSync(path.join(web, '.next/static'), path.join(bundledWeb, '.next/static'), { recursive: true });
  if (fs.existsSync(path.join(web, 'public'))) {
    fs.cpSync(path.join(web, 'public'), path.join(bundledWeb, 'public'), { recursive: true });
  }
  // Keep local configuration out of the packaged runtime, including Next's env copy.
  const removeLocalConfig = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.name.startsWith('.env')) fs.rmSync(target, { recursive: true, force: true });
      else if (entry.isDirectory()) removeLocalConfig(target);
    }
  };
  removeLocalConfig(standalone);
}

// Builder loads these named hooks from the paths in package.json.
function beforePack(context) {
  context.packager.config.extraMetadata.desktop.backendUrl = getBackendUrl();
}

function afterPack(context) {
  const resources = context.electronPlatformName === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents/Resources')
    : path.join(context.appOutDir, 'resources');
  for (const required of ['node_modules/next/package.json', 'apps/web/server.js', 'apps/web/.next/static']) {
    if (!fs.existsSync(path.join(resources, 'web/standalone', required))) {
      throw new Error(`Bundled reader runtime is incomplete: ${required}`);
    }
  }
}

if (require.main === module) {
  void buildReader().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { beforePack, afterPack };
