const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { serverStatus, desktopEnvironment } = require('../apps/electron/services/DevLauncher');

test('desktop launcher distinguishes ready, unhealthy and unavailable servers', async () => {
  const server = http.createServer((req, res) => {
    res.statusCode = req.url === '/files' ? 401 : 200;
    res.end('test');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.deepEqual(await serverStatus(base), { reachable: true, healthy: true });
    assert.deepEqual(await serverStatus(base, true), { reachable: true, healthy: true });
    // The launcher checks the origin root; use a separate unhealthy origin.
    server.removeAllListeners('request');
    server.on('request', (_req, res) => { res.writeHead(500); res.end(); });
    assert.deepEqual(await serverStatus(base), { reachable: true, healthy: false });
  } finally { await new Promise(resolve => server.close(resolve)); }
  assert.deepEqual(await serverStatus(base), { reachable: false, healthy: false });
});

test('desktop launcher removes Electron Node mode without changing the terminal environment', () => {
  const original = { ELECTRON_RUN_AS_NODE: '1', ELECTRON_BACKEND_URL: 'http://localhost:2007', PATH: '/bin' };
  assert.deepEqual(desktopEnvironment(original), { ELECTRON_BACKEND_URL: 'http://localhost:2007', PATH: '/bin' });
  assert.equal(original.ELECTRON_RUN_AS_NODE, '1');
});
