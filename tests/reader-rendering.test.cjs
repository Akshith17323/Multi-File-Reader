const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const ts = require('typescript');

function loadUtility(name, extra = {}) {
  const filename = path.resolve(__dirname, '../apps/web/utils', name + '.ts');
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require, TextDecoder, Uint8Array, URL, Blob, setTimeout, clearTimeout, ...extra }, { filename });
  return module.exports;
}

const decoder = loadUtility('textReader');
test('text reader decodes BOMs, legacy text, and all common line endings', () => {
  const sample = 'Hello 世界\r\nsecond\rthird';
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(sample, 'utf16le')]);
  const buffer = data => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  assert.equal(decoder.decodeText(buffer(utf16), 'text/plain; charset=utf-8'), 'Hello 世界\nsecond\nthird');
  const bigEndian = Buffer.from(utf16).swap16();
  assert.equal(decoder.decodeText(buffer(bigEndian)), 'Hello 世界\nsecond\nthird');
  assert.equal(decoder.decodeText(buffer(Buffer.from([0x63, 0x61, 0x66, 0xe9]))), 'café');
  assert.equal(decoder.decodeText(buffer(Buffer.from('\ufeffHello\n世界'))), 'Hello\n世界');
  assert.equal(decoder.decodeText(new ArrayBuffer(0)), '');
});

test('EPUB assets load per chapter, keep missing asset positions, and cache CSS dependencies', async () => {
  const loads = [];
  const hooks = [];
  let destroyed = 0;
  const book = {
    destroy: () => { destroyed++; },
    resolve: href => '/OPS/' + href,
    archive: { getText: async () => '.cover { background: url("images/cover(1).png"); }' },
    spine: { hooks: { serialize: { register: callback => hooks.push(callback) } } },
    resources: {
      urls: ['images/missing.png', 'images/cover(1).png', 'styles.css', 'images/unread.png'],
      cssUrls: ['styles.css'],
      relativeTo() { return this.urls; },
      async createUrl(url) {
        loads.push(url);
        if (url.endsWith('/missing.png')) throw new Error('Missing optional asset');
        return 'blob:' + url;
      },
    },
  };
  const utility = loadUtility('epubReader', { require: name => name === 'epubjs' ? { default: () => book, __esModule: true } : require(name) });
  utility.createReaderBook();
  await book.replacements();
  assert.deepEqual(loads, [], 'Opening a book must not unzip assets for unread chapters');
  const section = { url: '/OPS/chapter.xhtml' };
  await hooks[0]('<img src="images/missing.png"/><img src="images/cover(1).png"/><link href="styles.css"/>', section);
  assert.match(section.output, /data:application\/octet-stream,/);
  assert.match(section.output, /blob:\/OPS\/images\/cover\(1\)\.png/);
  assert(!loads.includes('/OPS/images/unread.png'));
  const cssUrl = book.resources.replacementUrls[2];
  assert.match(await (await fetch(cssUrl)).text(), /blob:\/OPS\/images\/cover\(1\)\.png/);
  const previousLoads = loads.length;
  await hooks[0]('<img src="images/cover(1).png"/><link href="styles.css"/>', section);
  assert.equal(loads.length, previousLoads, 'Shared images and fonts should be unzipped once');
  book.destroy();
  assert.equal(destroyed, 1);
  await assert.rejects(fetch(cssUrl), 'Closing the book must revoke generated CSS blobs');
});

test('EPUB URL replacement handles regex characters and replaces matching filenames literally', () => {
  const { replaceEpubUrls } = loadUtility('epubReader');
  assert.equal(replaceEpubUrls('a[1].png a1Xpng cover(.png', ['a[1].png', 'cover(.png'], ['blob:$&', 'blob:cover']), 'blob:$& a1Xpng blob:cover');
});

test('EPUB progress is available without scanning chapter text and handles boundaries', () => {
  const { epubProgress } = loadUtility('epubReader');
  const book = { spine: { each: callback => [{ linear: false, index: 0 }, { linear: true, index: 1 }, { linear: true, index: 2 }].forEach(callback) } };
  const location = { start: { index: 2, displayed: { page: 3, total: 4 } } };
  assert.equal(epubProgress(book, location), 75);
  assert.equal(epubProgress(book, { ...location, atStart: true }), 0);
  assert.equal(epubProgress(book, { ...location, atEnd: true }), 100);
});

test('EPUB display errors reject promptly even when EPUB.js leaves its display promise pending', async () => {
  const { displayEpub } = loadUtility('epubReader');
  const rendition = new EventEmitter();
  rendition.book = { spine: { get: () => ({ load: async () => {} }) }, load: () => {} };
  rendition.display = () => new Promise(() => {});
  const result = displayEpub(rendition, 'chapter.xhtml');
  rendition.emit('displayError', new Error('Broken chapter'));
  await assert.rejects(result, /Broken chapter/);
  assert.equal(rendition.listenerCount('displayError'), 0);
});

test('EPUB rendering times out instead of leaving the reader loading forever', async () => {
  let timeout;
  const { displayEpub } = loadUtility('epubReader', { setTimeout: callback => { timeout = callback; return 1; }, clearTimeout: () => {} });
  const rendition = new EventEmitter();
  rendition.book = { spine: { get: () => ({ load: async () => {} }) }, load: () => {} };
  rendition.display = () => new Promise(() => {});
  const result = displayEpub(rendition);
  timeout();
  await assert.rejects(result, /too long to render/);
  assert.equal(rendition.listenerCount('displayError'), 0);
});

test('missing EPUB chapters fail before entering the display queue', async () => {
  const { displayEpub } = loadUtility('epubReader');
  const rendition = new EventEmitter();
  rendition.book = { spine: { get: () => ({ load: async () => { throw new Error('Missing chapter'); } }) }, load: () => {} };
  rendition.display = () => assert.fail('A missing chapter must not enter the display queue');
  await assert.rejects(displayEpub(rendition), /Missing chapter/);
  assert.equal(rendition.listenerCount('displayError'), 0);
});
