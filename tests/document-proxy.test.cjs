const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { Readable } = require('node:stream');

const filename = path.resolve(__dirname, '../apps/server/src/router/proxy.js');
const actualRequire = createRequire(filename);
const express = actualRequire('express');
const documentUrl = 'https://storage.googleapis.com/test-bucket/user/a.pdf';
const bytes = Buffer.from('%PDF-1.4\nexample document');

async function withProxy(t, file, check) {
  const calls = [];
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, console: { error() {} },
    require: name => name === '../gcs' ? {
      bucketName: 'test-bucket', bucket: { file(objectPath) { calls.push(objectPath); return file; } },
    } : actualRequire(name),
  }, { filename });
  const app = express();
  app.use(module.exports);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/proxy?url=${encodeURIComponent(documentUrl)}`;
  await check(url, calls);
}

function readableFile() {
  return {
    async getMetadata() { return [{ size: bytes.length, contentType: 'application/pdf' }]; },
    createReadStream(options) {
      return Readable.from([bytes.subarray(options.start || 0, options.end === undefined ? bytes.length : options.end + 1)]);
    },
  };
}

test('document proxy serves the same private object through full, range, and HEAD requests', async t => {
  await withProxy(t, readableFile(), async (url, calls) => {
    const full = await fetch(url);
    assert.equal(full.status, 200);
    assert.equal(full.headers.get('content-type'), 'application/pdf');
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), bytes);
    for (const [range, start, end] of [['bytes=2-7', 2, 7], ['bytes=-4', bytes.length - 4, bytes.length - 1], ['bytes=8-', 8, bytes.length - 1]]) {
      const response = await fetch(url, { headers: { Range: range } });
      assert.equal(response.status, 206);
      assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/${bytes.length}`);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(start, end + 1));
    }
    const head = await fetch(url, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), String(bytes.length));
    assert.equal(await head.text(), '');
    assert(calls.every(objectPath => objectPath === 'user/a.pdf'));
  });
});

test('document proxy rejects invalid ranges and URLs outside its bucket', async t => {
  await withProxy(t, readableFile(), async (url, calls) => {
    for (const range of ['bytes=999-', 'bytes=9-1', 'bytes=0-1,3-4', 'bytes=-0']) {
      const response = await fetch(url, { headers: { Range: range } });
      assert.equal(response.status, 416);
      assert.equal(response.headers.get('content-range'), `bytes */${bytes.length}`);
      await response.arrayBuffer();
    }
    const previousCalls = calls.length;
    const unsafe = new URL(url);
    unsafe.searchParams.set('url', 'https://example.com/private.pdf');
    const response = await fetch(unsafe);
    assert.equal(response.status, 400);
    assert.equal(calls.length, previousCalls);
    await response.text();
  });
});

test('disabled cloud billing returns an actionable 503 instead of a generic 500', async t => {
  const file = { async getMetadata() {
    throw Object.assign(new Error('The billing account for the owning project is disabled in state closed'), { code: 403 });
  } };
  await withProxy(t, file, async url => {
    const response = await fetch(url);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.match(await response.text(), /billing is disabled/);
  });
});

test('document proxy preserves missing/access-denied errors and classifies upstream outages', async t => {
  for (const [code, status] of [[404, 404], [403, 403], [500, 502]]) {
    await withProxy(t, { async getMetadata() { throw Object.assign(new Error('Upstream failure'), { code }); } }, async url => {
      const response = await fetch(url);
      assert.equal(response.status, status);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      await response.text();
    });
  }
});

test('stream errors before the first byte clear PDF/range headers and send a complete error body', async t => {
  const file = readableFile();
  file.createReadStream = () => new Readable({ read() {
    this.destroy(Object.assign(new Error('Storage unavailable'), { code: 500 }));
  } });
  await withProxy(t, file, async url => {
    const response = await fetch(url, { headers: { Range: 'bytes=0-7' } });
    assert.equal(response.status, 502);
    assert.match(response.headers.get('content-type'), /text\/plain/);
    assert.equal(response.headers.get('content-range'), null);
    assert.equal(response.headers.get('accept-ranges'), null);
    const body = await response.text();
    assert.equal(Number(response.headers.get('content-length')), Buffer.byteLength(body));
    assert.match(body, /Could not read document from cloud storage/);
  });
});
