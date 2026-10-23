const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
};

function browserModules(api = {}, extra = {}) {
  const localStorage = storage();
  const sessionStorage = storage();
  const timers = new Map();
  let timerId = 0;
  const window = { location: { pathname: '/files', assign: () => {} }, dispatchEvent: () => {} };
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const requireMock = specifier => {
      if (specifier === '@/services/apiClient') return { apiClient: api };
      if (specifier === '../hooks/useEnvironment' || specifier === '@/hooks/useEnvironment') return { isElectron: () => Boolean(window.electronAPI) };
      let destination = specifier.startsWith('@/') ? path.join(root, 'apps/web', specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
      if (!destination.endsWith('.ts')) destination += '.ts';
      return load(destination);
    };
    vm.runInNewContext(source, { module, exports: module.exports, require: requireMock, localStorage, sessionStorage, window, console, URLSearchParams, URL, atob, Event, AbortSignal, FormData, Blob, process: { env: {} },
      setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id), ...extra }, { filename });
    return module.exports;
  }
  return { load, localStorage, sessionStorage, window, timers, async flush() {
    const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback());
    await new Promise(resolve => setImmediate(resolve));
  } };
}

function serverModule(relative, mocks = {}) {
  const filename = path.join(root, relative);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module, exports: module.exports, require: name => name === 'dotenv' ? { config() {} } : name in mocks ? mocks[name] : require(require.resolve(name, { paths: [path.dirname(filename)] })), console: { log() {}, warn() {}, error() {} }, process, Buffer, URL, AbortSignal, ...mocks.globals }, { filename });
  return module.exports;
}

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, cookie() { return this; }, clearCookie() { return this; } };
}
const authenticated = (extra = {}) => ({ user: { userId: 'user-a' }, body: {}, query: {}, params: {}, ...extra });
const tokenFor = id => `header.${Buffer.from(JSON.stringify({ userId: id })).toString('base64url')}.signature`;

test('reader URL round-trips commas, percent signs, Unicode, query strings, and fragments', () => {
  const browser = browserModules();
  const session = browser.load('apps/web/utils/readerSession.ts');
  const urls = ['https://storage.googleapis.com/b/a,b%25.pdf?q=x,y#chapter', 'mfr-local:///books/hello%20%E4%B8%96%E7%95%8C.epub'];
  const url = session.createReaderUrl(urls, 1);
  const params = new URL(url, 'http://localhost').searchParams;
  assert.deepEqual(plain(session.parseReaderFiles(params.get('files'))), urls);
  assert.equal(params.get('active'), '1');
});

test('reader rejects empty and unsafe URLs, deduplicates tabs, and clamps invalid indexes', () => {
  const session = browserModules().load('apps/web/utils/readerSession.ts');
  assert.deepEqual(plain(session.parseReaderFiles('["", "javascript:alert(1)", "https://x/a.pdf", "https://x/a.pdf"]')), ['https://x/a.pdf']);
  assert.equal(session.clampActiveIndex(NaN, 3), 0);
  assert.equal(session.clampActiveIndex(-1, 3), 0);
  assert.equal(session.clampActiveIndex(99, 3), 2);
});

test('reader session and bookmarks stay separate between accounts', () => {
  const browser = browserModules();
  const session = browser.load('apps/web/utils/readerSession.ts');
  const bookmarks = browser.load('apps/web/utils/localBookmarks.ts');
  browser.localStorage.setItem('token', tokenFor('a'));
  session.saveReaderSession(['https://x/a.pdf'], 0);
  bookmarks.saveLocalBookmark({ fileUrl: 'https://x/a.pdf', pageNumber: 8 });
  browser.localStorage.setItem('token', tokenFor('b'));
  assert.equal(session.getLastReaderSession(), null);
  assert.equal(bookmarks.getLocalBookmark('https://x/a.pdf'), null);
  browser.localStorage.setItem('token', tokenFor('a'));
  assert.equal(session.getLastReaderSession().fileUrls[0], 'https://x/a.pdf');
  assert.equal(bookmarks.getLocalBookmark('https://x/a.pdf').pageNumber, 8);
});

test('deleting the active document removes it from the saved session', () => {
  const browser = browserModules();
  const session = browser.load('apps/web/utils/readerSession.ts');
  session.saveReaderSession(['https://x/a.pdf', 'https://x/b.pdf'], 1);
  session.removeFileFromReaderSession('https://x/b.pdf');
  assert.deepEqual(plain(session.getLastReaderSession().fileUrls), ['https://x/a.pdf']);
  assert.equal(session.getLastReaderSession().activeIndex, 0);
  session.removeFileFromReaderSession('https://x/a.pdf');
  assert.equal(session.getLastReaderSession(), null);
});

test('local URLs use direct file access and encoded extensions detect correctly', () => {
  const urls = browserModules().load('apps/web/utils/fileUrls.ts');
  assert.equal(urls.getDocumentUrl('local:///books/a b#c.pdf'), 'mfr-local://localhost/books/a%20b%23c.pdf');
  assert.equal(urls.getDocumentUrl('mfr-local:///books/a.txt'), 'mfr-local://localhost/books/a.txt');
  assert.equal(urls.getDocumentUrl('mfr-local:///Users/Alice/a%25.pdf'), 'mfr-local://localhost/Users/Alice/a%25.pdf');
  assert.equal(urls.normalizeFileUrl('mfr-local:///Users/Alice/a%25.pdf'), 'mfr-local:///Users/Alice/a%25.pdf');
  assert.equal(urls.detectFileType('https://x/a%2Epdf?token=abc'), 'pdf');
  assert.equal(urls.detectFileType('APPLICATION/EPUB+ZIP'), 'epub');
});

test('partial bookmark events preserve CFI and saved pages', () => {
  const bookmarks = browserModules().load('apps/web/utils/localBookmarks.ts');
  bookmarks.saveLocalBookmark({ fileUrl: 'https://x/a.epub', cfi: 'cfi-8', progress: 80 });
  bookmarks.saveLocalBookmark({ fileUrl: 'https://x/a.epub', cfi: undefined, progress: 0 });
  assert.equal(bookmarks.getLocalBookmark('https://x/a.epub').cfi, 'cfi-8');
  assert.equal(bookmarks.getLocalBookmark('https://x/a.epub').progress, 0);
});

test('missing remote bookmarks preserve local progress and stale remote data cannot replace it', async () => {
  const browser = browserModules({ getBookmark: async () => null });
  const bookmarks = browser.load('apps/web/utils/localBookmarks.ts');
  bookmarks.saveLocalBookmark({ fileUrl: 'https://x/a.pdf', pageNumber: 6 });
  assert.equal((await bookmarks.getBookmarkUnified('token', 'https://x/a.pdf')).pageNumber, 6);
  const merged = bookmarks.mergeBookmarks([{ fileUrl: 'x', progress: 5, lastRead: '2020-01-01' }], { x: { fileUrl: 'x', progress: 50, lastRead: '2025-01-01' } });
  assert.equal(merged[0].progress, 50);
});

test('rapid bookmark saves coalesce and deletion cancels pending writes', async () => {
  const writes = [];
  const deletes = [];
  const browser = browserModules({ upsertBookmark: async (token, data) => writes.push(data.progress), deleteBookmark: async (token, url) => deletes.push(url) });
  browser.localStorage.setItem('token', 'token');
  const bookmarks = browser.load('apps/web/utils/localBookmarks.ts');
  await bookmarks.saveBookmarkUnified('token', { fileUrl: 'x', progress: 20 });
  await bookmarks.saveBookmarkUnified('token', { fileUrl: 'x', progress: 40 });
  await browser.flush();
  assert.deepEqual(writes, [40]);
  await bookmarks.saveBookmarkUnified('token', { fileUrl: 'x', progress: 60 });
  await bookmarks.deleteBookmarkUnified('token', 'x');
  await browser.flush();
  assert.deepEqual(writes, [40]);
  assert.deepEqual(deletes, ['x']);
  assert.equal(bookmarks.getLocalBookmark('x'), null);
});

test('auth session rejects missing tokens and clears reader tabs on sign-out', () => {
  const browser = browserModules();
  const auth = browser.load('apps/web/utils/authSession.ts');
  assert.throws(() => auth.setAuthSession({ user: 'Alice' }), /valid session/);
  auth.setAuthSession({ token: 'token', user: 'Alice' });
  browser.sessionStorage.setItem('readerFiles', 'private');
  auth.clearAuthSession();
  assert.equal(browser.localStorage.getItem('token'), null);
  assert.equal(browser.sessionStorage.getItem('readerFiles'), null);
});

test('expired authenticated API requests clear the session and redirect to login', async () => {
  const browser = browserModules({}, { fetch: async () => ({ ok: false, status: 401, json: async () => ({ message: 'Expired' }) }) });
  browser.localStorage.setItem('token', 'expired');
  let destination;
  browser.window.location.assign = url => { destination = url; };
  const { ApiAdapter } = browser.load('apps/web/services/apiClient.ts');
  await assert.rejects(ApiAdapter.fetch('/files', { headers: { Authorization: 'Bearer expired' } }), /Expired/);
  assert.equal(destination, '/auth/login');
  assert.equal(browser.localStorage.getItem('token'), null);
});

test('upload stays below 100 percent until server response and rejects a missing URL', async () => {
  let xhr;
  class FakeXHR { constructor() { xhr = this; this.upload = {}; } open() {} setRequestHeader() {} send() {} }
  const browser = browserModules({}, { XMLHttpRequest: FakeXHR });
  const { FileAdapter } = browser.load('apps/web/services/fileAdapter.ts');
  const progress = [];
  const promise = FileAdapter.uploadFile(new File(['sample'], 'a.txt', { type: 'text/plain' }), 'token', '/upload', p => progress.push(p));
  xhr.upload.onprogress({ lengthComputable: true, loaded: 10, total: 10 });
  assert.deepEqual(progress, [95]);
  xhr.status = 200; xhr.responseText = '{}'; xhr.onload();
  await assert.rejects(promise, /no document URL/);
});

test('desktop local library returns the server-provided readable URL', async () => {
  const browser = browserModules();
  browser.window.electronAPI = { invoke: async () => ({ ok: true, data: { file: { fileUrl: 'mfr-local:///a.pdf', fileName: 'a.pdf' } } }) };
  const { FileAdapter } = browser.load('apps/web/services/fileAdapter.ts');
  assert.equal((await FileAdapter.addLocalBook('token')).url, 'mfr-local:///a.pdf');
});

test('sign-up validates whitespace, malformed email, and short passwords before database writes', async () => {
  let queried = false;
  const auth = serverModule('apps/server/src/auth/auth.js', { '../prisma': { user: { findUnique: async () => { queried = true; } } } });
  for (const body of [{ name: ' ', email: 'a@b.com', password: 'abcdef' }, { name: 'A', email: 'invalid', password: 'abcdef' }, { name: 'A', email: 'a@b.com', password: 'short' }]) {
    const res = response(); await auth.signup({ body }, res); assert.equal(res.statusCode, 400);
  }
  assert.equal(queried, false);
});

test('Google-only accounts show a usable sign-in error instead of bcrypt crashing', async () => {
  const auth = serverModule('apps/server/src/auth/auth.js', { '../prisma': { user: { findUnique: async () => ({ password: null }) } } });
  const res = response(); await auth.login({ body: { email: 'a@b.com', password: 'anything' } }, res);
  assert.equal(res.statusCode, 401);
  assert.match(res.body.message, /Google/);
});

test('file listing rejects invalid pagination and sorting', async () => {
  const handler = serverModule('apps/server/src/files/allFiles.js', { '../prisma': {} }).get_all_files;
  for (const query of [{ page: '0' }, { limit: '1000' }, { order: 'invalid' }, { page: 'NaN' }, { search: ['a', 'b'] }]) {
    const res = response(); await handler(authenticated({ query }), res); assert.equal(res.statusCode, 400);
  }
});

test('file listing clamps deleted final pages and returns readable local URLs', async () => {
  let args;
  const handler = serverModule('apps/server/src/files/allFiles.js', { '../prisma': { file: { count: async () => 1, findMany: async value => {
    args = value; return [{ id: 'local', source: 'LOCAL', localId: '/a b.pdf', fileUrl: null, fileName: 'a b.pdf', fileSize: '1 KB', fileType: 'application/pdf' }];
  } } } }).get_all_files;
  const res = response(); await handler(authenticated({ query: { page: '8', limit: '24' } }), res);
  assert.equal(res.body.pagination.currentPage, 1);
  assert.equal(args.skip, 0);
  assert.equal(res.body.files[0].url, 'mfr-local://localhost/a%20b.pdf');
});

test('bookmark API returns null for absent progress and updates lastRead on saves', async () => {
  let args;
  const handlers = serverModule('apps/server/src/bookmarks/bookmarks.js', { '../prisma': { bookmark: { findUnique: async () => null, upsert: async data => { args = data; return data; }, deleteMany: async () => ({ count: 0 }) } } });
  const missing = response(); await handlers.getBookmark(authenticated({ query: { fileUrl: 'x' } }), missing); assert.equal(missing.body, null);
  const saved = response(); await handlers.upsertBookmark(authenticated({ body: { fileUrl: 'x', progress: 0 } }), saved);
  assert.ok(args.update.lastRead);
  assert.equal(args.update.progress, 0);
  const removed = response(); await handlers.deleteBookmark(authenticated({ query: { fileUrl: 'x' } }), removed); assert.equal(removed.statusCode, 200);
});

test('bookmark API rejects percentages outside 0–100 and invalid pages', async () => {
  const handlers = serverModule('apps/server/src/bookmarks/bookmarks.js', { '../prisma': {} });
  for (const body of [{ fileUrl: 'x', progress: 101 }, { fileUrl: 'x', progress: -1 }, { fileUrl: 'x', pageNumber: 0 }]) {
    const res = response(); await handlers.upsertBookmark(authenticated({ body }), res); assert.equal(res.statusCode, 400);
  }
});

test('renaming preserves document extensions and updates bookmark names transactionally', async () => {
  let fileUpdate, bookmarkUpdate;
  const file = { id: 'file', fileName: 'original.pdf', fileUrl: 'https://x/a.pdf', source: 'CLOUD' };
  const prisma = { file: { findFirst: async () => file }, $transaction: async callback => callback({ file: { update: async args => { fileUpdate = args; return { ...file, ...args.data }; } }, bookmark: { updateMany: async args => { bookmarkUpdate = args; } } }) };
  const handler = serverModule('apps/server/src/files/updateFile.js', { '../prisma': prisma }).updateFile;
  const res = response(); await handler(authenticated({ params: { id: 'file' }, body: { fileName: 'Renamed' } }), res);
  assert.equal(fileUpdate.data.fileName, 'Renamed.pdf');
  assert.equal(bookmarkUpdate.data.fileName, 'Renamed.pdf');
  assert.equal(bookmarkUpdate.where.userId, 'user-a');
});

test('deleting a local file never deletes objects from cloud storage or other users bookmarks', async () => {
  let cloudCalls = 0, bookmarkWhere;
  const prisma = { file: { findFirst: async () => ({ id: 'file', source: 'LOCAL', fileUrl: 'mfr-local:///a.pdf' }) }, $transaction: async callback => callback({ file: { delete: async () => {} }, bookmark: { deleteMany: async args => { bookmarkWhere = args.where; } } }) };
  const handler = serverModule('apps/server/src/files/deleteFile.js', { '../prisma': prisma, '../gcs': { bucketName: 'bucket', bucket: { file: () => { cloudCalls++; } } } }).deleteFile;
  const res = response(); await handler(authenticated({ params: { filename: 'file' } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(cloudCalls, 0);
  assert.equal(bookmarkWhere.userId, 'user-a');
});

test('desktop uploads validate generic MIME types by supported extension', () => {
  let options;
  const multer = Object.assign(value => { options = value; return { fields: () => () => {} }; }, { memoryStorage: () => ({}) });
  serverModule('apps/server/src/router/fileUpload.js', { multer, '../upload/upload': { uploadFile() {}, addLocalFile() {}, addDriveFile() {} }, '../middleware/authMiddleware': () => {} });
  const pdf = { fieldname: 'UploadingFile', originalname: 'BOOK.PDF', mimetype: 'application/octet-stream' };
  let accepted;
  options.fileFilter({}, pdf, (error, ok) => { assert.equal(error, null); accepted = ok; });
  assert.equal(accepted, true); assert.equal(pdf.mimetype, 'application/pdf');
  options.fileFilter({}, { fieldname: 'UploadingFile', originalname: 'bad.exe', mimetype: 'application/pdf' }, error => assert.ok(error));
  assert.equal(options.limits.fileSize, 50 * 1024 * 1024);
});

test('uploads encode special filenames and clean cloud objects after database failure', async () => {
  const deleted = [];
  const bucket = { file: name => ({ makePublic: async () => {}, delete: async () => deleted.push(name), createWriteStream: () => {
    const stream = new EventEmitter(); stream.end = () => { stream.emit('finish'); }; return stream;
  } }) };
  const handlers = serverModule('apps/server/src/upload/upload.js', { '../gcs': { bucket, bucketName: 'bucket' }, '../prisma': { file: { create: async () => { throw new Error('DB unavailable'); } } } });
  const res = response();
  await handlers.uploadFile(authenticated({ files: { UploadingFile: [{ originalname: 'a #?%.pdf', mimetype: 'application/pdf', size: 1, buffer: Buffer.from('x') }] } }), res);
  assert.equal(res.statusCode, 500);
  assert.equal(deleted.length, 1);
  assert.match(deleted[0], /a #\?%\.pdf$/);
});

test('storage paths reject foreign buckets and preserve literal percent signs', () => {
  const { getStorageObjectPath, toLocalUrl } = require('../apps/server/src/utils/fileTypes');
  assert.equal(getStorageObjectPath('https://storage.googleapis.com/bucket/a%25%23.pdf?token=x', 'bucket'), 'a%#.pdf');
  assert.equal(getStorageObjectPath('https://evil.test/bucket/a.pdf', 'bucket'), null);
  assert.equal(getStorageObjectPath('https://storage.googleapis.com/other/a.pdf', 'bucket'), null);
  assert.equal(toLocalUrl('/a #?%.pdf'), 'mfr-local://localhost/a%20%23%3F%25.pdf');
});

test('desktop protocol round-trips raw and encoded paths', () => {
  const { extractPathFromLocalUrl } = serverModule('apps/electron/adapters/FileHandlerAdapter.js', { electron: {} });
  assert.equal(extractPathFromLocalUrl('/a%book.pdf'), '/a%book.pdf');
  assert.equal(extractPathFromLocalUrl('mfr-local:///a%20%23%3F%25.pdf'), '/a #?%.pdf');
});

test('PDF renderer and worker use the same PDF.js version', () => {
  const reactPdf = require('react-pdf/package.json');
  const pdfjs = require('pdfjs-dist/package.json');
  assert.equal(pdfjs.version, reactPdf.dependencies['pdfjs-dist']);
});

test('desktop bridge exposes all local reading channels and native file paths', async () => {
  let bridge;
  const calls = [];
  serverModule('apps/electron/preload.js', {
    electron: { contextBridge: { exposeInMainWorld: (name, api) => { bridge = api; } }, ipcRenderer: { invoke: async (...args) => calls.push(args), send() {} }, webUtils: { getPathForFile: () => '/a.pdf' } },
    globals: { window: { addEventListener() {} } },
  });
  for (const channel of ['open-local-file', 'check-file-permission', 'check-local-files-status', 'relink-local-file']) await bridge.invoke(channel);
  assert.equal(calls.length, 4);
  assert.equal(bridge.getFilePath({}), '/a.pdf');
  await assert.rejects(bridge.invoke('invalid'), /Unsupported/);
});

test('relink drains queued bookmark sync without resurrecting the old URL', async () => {
  const writes = [];
  const browser = browserModules({ upsertBookmark: async (token, data) => writes.push(data.fileUrl), deleteBookmark: async () => {} });
  browser.localStorage.setItem('token', 'token');
  const bookmarks = browser.load('apps/web/utils/localBookmarks.ts');
  await bookmarks.saveBookmarkUnified('token', { fileUrl: 'old', progress: 70 });
  await bookmarks.flushBookmarkSync('token', 'old');
  await bookmarks.saveBookmarkUnified('token', { ...bookmarks.getLocalBookmark('old'), fileUrl: 'new' });
  await bookmarks.deleteBookmarkUnified('token', 'old');
  await browser.flush();
  assert.deepEqual(writes, ['old', 'new']);
  assert.equal(bookmarks.getLocalBookmark('old'), null);
  assert.equal(bookmarks.getLocalBookmark('new').progress, 70);
});

test('an account switch while fetching progress cannot contaminate the new account', async () => {
  let finish;
  const browser = browserModules({ getBookmark: () => new Promise(resolve => { finish = resolve; }) });
  const bookmarks = browser.load('apps/web/utils/localBookmarks.ts');
  browser.localStorage.setItem('token', tokenFor('a'));
  const request = bookmarks.getBookmarkUnified(tokenFor('a'), 'x');
  browser.localStorage.setItem('token', tokenFor('b'));
  finish({ fileUrl: 'x', progress: 80 });
  assert.equal(await request, null);
  assert.equal(bookmarks.getLocalBookmark('x'), null);
});

test('local registration preserves human-readable file sizes', async () => {
  let created;
  const handlers = serverModule('apps/server/src/upload/upload.js', { '../gcs': {}, '../prisma': { file: { findFirst: async () => null, create: async args => { created = args.data; return args.data; } } } });
  const res = response();
  await handlers.addLocalFile(authenticated({body:{ fileName:'a.pdf',localId:'/a.pdf',fileUrl:'mfr-local:///a.pdf',fileSize:'12.5 KB' }}),res);
  assert.equal(res.statusCode,200);
  assert.equal(created.fileSize,'12.5 KB');
});

test('progress saved during a cloud read wins over the older response', async () => {
  let finish;
  const browser = browserModules({ getBookmark: () => new Promise(resolve => { finish = resolve; }) });
  const bookmarks = browser.load('apps/web/utils/localBookmarks.ts');
  const request = bookmarks.getBookmarkUnified('token', 'x');
  bookmarks.saveLocalBookmark({fileUrl:'x',progress:90});
  finish({fileUrl:'x',progress:10,lastRead:'2020-01-01'});
  assert.equal((await request).progress,90);
  assert.equal(bookmarks.getLocalBookmark('x').progress,90);
});

test('closing reader tabs preserves the selected document and selects a neighbor for an active close', () => {
  const tabs = browserModules().load('apps/web/utils/readerTabs.ts');
  assert.equal(tabs.getIndexAfterTabClose(2, 0, 4), 1);
  assert.equal(tabs.getIndexAfterTabClose(1, 3, 4), 1);
  assert.equal(tabs.getIndexAfterTabClose(1, 1, 4), 1);
  assert.equal(tabs.getIndexAfterTabClose(3, 3, 4), 2);
  assert.equal(tabs.getIndexAfterTabClose(0, 0, 1), 0);
});

test('opening an existing reader file switches tabs without duplicating or replacing its identity', () => {
  const { addReaderTab } = browserModules().load('apps/web/utils/readerTabs.ts');
  const files = [{id:'a',url:'https://x/a.pdf',name:'A.pdf',type:'pdf'}];
  const existing = addReaderTab(files,{...files[0],name:'Duplicate.pdf'});
  assert.equal(existing.files,files);
  assert.equal(existing.activeIndex,0);
  const added = addReaderTab(files,{id:'b',url:'https://x/b.pdf',name:'B.pdf',type:'pdf'});
  assert.equal(added.files.length,2);
  assert.equal(added.activeIndex,1);
  assert.equal(files.length,1);
});

test('desktop local URLs preserve Windows drives, network shares, Unicode, and literal percent signs', () => {
  const { toLocalUrl } = require('../apps/server/src/utils/fileTypes');
  const { extractPathFromLocalUrl } = serverModule('apps/electron/adapters/FileHandlerAdapter.js', { electron: {} });
  const urls = browserModules().load('apps/web/utils/fileUrls.ts');
  const windowsPath = String.raw`C:\Books\hello 世界 #?%.pdf`;
  const networkPath = String.raw`\\server\books\a b.pdf`;
  for (const [filePath, platform] of [[windowsPath, 'win32'], [networkPath, 'win32'], ['/books/hello 世界 #?%.pdf', 'darwin']]) {
    const url = toLocalUrl(filePath);
    assert.equal(new URL(url).hostname, 'localhost');
    assert.equal(extractPathFromLocalUrl(url, platform), filePath);
    assert.equal(urls.normalizeFileUrl(filePath), url);
  }
  assert.equal(extractPathFromLocalUrl('mfr-local://private/tmp/a%20b.pdf', 'darwin'), '/private/tmp/a b.pdf');
  assert.equal(extractPathFromLocalUrl('file://server/books/a%20b.pdf', 'win32'), String.raw`\\server\books\a b.pdf`);
  assert.equal(urls.normalizeFileUrl('file:///C:/Books/a%25.pdf'), 'mfr-local://localhost/C:/Books/a%25.pdf');
  assert.equal(urls.normalizeFileUrl('mfr-local://C:%5CBooks%5Ca.pdf'), 'mfr-local://localhost/C:/Books/a.pdf');
  assert.equal(urls.isLocalFileUrl(networkPath), true);
});

test('desktop document downloads use the configured backend URL', () => {
  const browser = browserModules();
  browser.window.electronAPI = { backendUrl: 'https://backend.example/app/' };
  const urls = browser.load('apps/web/utils/fileUrls.ts');
  assert.equal(urls.getDocumentUrl('https://storage.example/a.pdf'), 'https://backend.example/app/proxy?url=https%3A%2F%2Fstorage.example%2Fa.pdf');
});

test('desktop local registration and cloud uploads clear expired sessions', async () => {
  const browser = browserModules();
  browser.window.electronAPI = {
    invoke: async () => ({ ok: false, status: 401, error: 'Session expired' }),
    getFilePath: () => '/books/a.pdf',
  };
  let destination;
  browser.window.location.assign = url => { destination = url; };
  const { FileAdapter } = browser.load('apps/web/services/fileAdapter.ts');
  browser.localStorage.setItem('token', 'expired');
  await assert.rejects(FileAdapter.addLocalBook('expired'), /Session expired/);
  assert.equal(destination, '/auth/login');
  assert.equal(browser.localStorage.getItem('token'), null);
  browser.localStorage.setItem('token', 'expired');
  await assert.rejects(FileAdapter.uploadFile(new File(['sample'], 'a.pdf'), 'expired', '/upload', () => {}), /Session expired/);
  assert.equal(browser.localStorage.getItem('token'), null);
});

test('desktop event subscriptions strip IPC events and return working cleanup functions', () => {
  let bridge;
  const ipc = new EventEmitter();
  serverModule('apps/electron/preload.js', {
    electron: { contextBridge: { exposeInMainWorld: (_name, api) => { bridge = api; } }, ipcRenderer: ipc, webUtils: {} },
  });
  const values = [];
  const listener = value => values.push(value);
  const unsubscribe = bridge.on('window-state-changed', listener);
  bridge.on('unsafe-channel', listener);
  assert.equal(ipc.listenerCount('window-state-changed'), 1);
  assert.equal(ipc.listenerCount('unsafe-channel'), 0);
  ipc.emit('window-state-changed', { sender: 'private' }, { maximized: true });
  assert.deepEqual(plain(values), [{ maximized: true }]);
  unsubscribe();
  assert.equal(ipc.listenerCount('window-state-changed'), 0);
});

function desktopFileHandlers({ picker, fetchResponse } = {}) {
  const handlers = new Map();
  let fetches = 0;
  serverModule('apps/electron/adapters/FileHandlerAdapter.js', {
    electron: { BrowserWindow: { fromWebContents: () => null, getFocusedWindow: () => null }, net: {} },
    globals: { fetch: async () => { fetches++; return fetchResponse; }, FormData, Blob, Response },
  }).registerFileHandlers({ handle: (channel, callback) => handlers.set(channel, callback) }, { handle() {} }, {
    showOpenDialog: picker || (async () => ({ canceled: true, filePaths: [] })),
  }, 'http://localhost:2007');
  return { handlers, fetchCount: () => fetches };
}

test('native dialogs report failures and malformed requests without rejecting IPC', async () => {
  const { handlers } = desktopFileHandlers({ picker: async () => { throw new Error('Dialog unavailable'); } });
  for (const channel of ['open-local-file', 'open-local-file-dialog', 'select-and-upload-file']) {
    assert.match((await handlers.get(channel)({})).error, /Dialog unavailable/);
  }
  const malformed = await handlers.get('relink-local-file')({}, { oldUrl: 'mfr-local:///%bad' });
  assert.match(malformed.error, /invalid/);
  for (const channel of ['relink-local-file', 'upload-dropped-file']) {
    const result = await handlers.get(channel)({}, null);
    assert.equal(result.ok, false);
    assert.equal(result.canceled, false);
  }
});

test('native uploads reject unsupported files, directories, and files over 50 MB before contacting the server', async () => {
  const os = require('node:os');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mfr-electron-test-'));
  const unsupported = path.join(directory, 'a.exe');
  const oversized = path.join(directory, 'large.pdf');
  fs.writeFileSync(unsupported, 'sample');
  fs.writeFileSync(oversized, '');
  fs.truncateSync(oversized, 50 * 1024 * 1024 + 1);
  try {
    const desktop = desktopFileHandlers();
    const upload = desktop.handlers.get('upload-dropped-file');
    assert.match((await upload({}, { filePath: unsupported })).error, /PDF, EPUB, or TXT/);
    assert.match((await upload({}, { filePath: directory })).error, /not a file/);
    assert.match((await upload({}, { filePath: oversized })).error, /50 MB/);
    assert.equal(desktop.fetchCount(), 0);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('native upload and registration preserve HTTP failures and reject successful responses without URLs', async () => {
  const os = require('node:os');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mfr-electron-test-'));
  const filePath = path.join(directory, 'a.pdf');
  fs.writeFileSync(filePath, 'sample');
  try {
    const picker = async () => ({ canceled: false, filePaths: [filePath] });
    for (const status of [401, 502, 200]) {
      const desktop = desktopFileHandlers({ picker, fetchResponse: { ok: status === 200, status, json: async () => { throw new Error('Non-JSON response'); } } });
      for (const channel of ['open-local-file-dialog', 'select-and-upload-file', 'upload-dropped-file']) {
        const argument = channel === 'upload-dropped-file' ? { token: 'token', filePath } : 'token';
        const result = await desktop.handlers.get(channel)({}, argument);
        if (status === 200) assert.match(result.error, /no .* (location|URL)/);
        else assert.equal(result.status, status);
      }
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('desktop API proxy rejects malformed endpoints and preserves backend statuses', async () => {
  const handlers = new Map();
  const requests = [];
  serverModule('apps/electron/services/ApiProxyService.js', {
    globals: { fetch: async (url, options) => { requests.push({ url, options }); return { ok: false, status: 401, json: async () => ({ message: 'Expired' }) }; } },
  }).registerApiProxy({ handle: (channel, callback) => handlers.set(channel, callback) }, 'https://api.example');
  const request = handlers.get('api-request');
  for (const options of [undefined, null, { endpoint: '//evil.example' }, { endpoint: 'https://evil.example' }, { endpoint: 5 }]) {
    assert.equal((await request({}, options)).status, 400);
  }
  assert.equal(requests.length, 0);
  const result = await request({}, { endpoint: '/files?q=a%20b', headers: { Authorization: 'Bearer token' } });
  assert.equal(requests[0].url, 'https://api.example/files?q=a%20b');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer token');
  assert.equal(result.status, 401);
});
