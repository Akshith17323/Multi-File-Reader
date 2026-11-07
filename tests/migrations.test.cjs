const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const migrations = path.resolve(__dirname, '../apps/server/prisma/migrations');
const directories = fs.readdirSync(migrations).filter(name => fs.existsSync(path.join(migrations, name, 'migration.sql'))).sort();
const sql = name => fs.readFileSync(path.join(migrations, name, 'migration.sql'), 'utf8');
const latest = directories.at(-1);

async function legacyDatabase() {
  const db = new PGlite();
  for (const directory of directories.slice(0, -1)) await db.exec(sql(directory));
  await db.exec(`
    INSERT INTO "User" (id, name, email, password, "updatedAt") VALUES ('u', 'Reader', 'reader@example.test', 'hash', now());
    INSERT INTO "File" (id, "userId", "fileName", "fileUrl", "fileSize", "fileType", "updatedAt")
      VALUES ('f', 'u', 'Book.pdf', 'https://storage.googleapis.com/b/book.pdf', '1 KB', 'application/pdf', now());
    INSERT INTO "Bookmark" (id, "userId", "fileId", progress, total, cfi, "updatedAt")
      VALUES ('b', 'u', 'f', 45, 200, 'saved-cfi', '2026-01-01');
  `);
  return db;
}

test('all migrations upgrade legacy records without losing bookmark data', async () => {
  const db = await legacyDatabase();
  try {
    await db.exec(sql(latest));
    const { rows: [bookmark] } = await db.query('SELECT * FROM "Bookmark"');
    assert.equal(bookmark.fileUrl, 'https://storage.googleapis.com/b/book.pdf');
    assert.equal(bookmark.fileName, 'Book.pdf');
    assert.equal(bookmark.progress, 45);
    assert.equal(bookmark.totalPages, 200);
    assert.equal(bookmark.cfi, 'saved-cfi');
    assert.equal(bookmark.lastRead.getTime(), bookmark.updatedAt.getTime());
    assert.equal(bookmark.createdAt.getTime(), bookmark.updatedAt.getTime());
    assert.equal('total' in bookmark, false);
    await db.exec(`INSERT INTO "User" (id, name, email, "providerId", "updatedAt") VALUES ('google', 'Google', 'google@example.test', 'provider', now());`);
    await db.exec(`INSERT INTO "File" (id, "userId", "fileName", source, "localId", "fileSize", "fileType", "updatedAt") VALUES ('local', 'u', 'Local.txt', 'LOCAL', '/books/local.txt', '1 B', 'text/plain', now());`);
    await db.exec(`DELETE FROM "File" WHERE id = 'f';`);
    assert.equal((await db.query('SELECT "fileId" FROM "Bookmark"')).rows[0].fileId, null);
    await assert.rejects(db.exec(`INSERT INTO "Bookmark" (id, "userId", "fileUrl", "updatedAt") VALUES ('duplicate', 'u', 'https://storage.googleapis.com/b/book.pdf', now());`), /unique/i);
    // A schema updated manually can safely run the additive migration again.
    await db.exec(sql(latest));
    assert.equal((await db.query('SELECT count(*)::int AS count FROM "Bookmark"')).rows[0].count, 1);
  } finally { await db.close(); }
});

test('ambiguous legacy bookmarks abort the entire migration without discarding data', async () => {
  const db = await legacyDatabase();
  try {
    await db.exec(`
      INSERT INTO "File" (id, "userId", "fileName", "fileUrl", "fileSize", "fileType", "updatedAt")
        VALUES ('duplicate-file', 'u', 'Another.pdf', 'https://storage.googleapis.com/b/book.pdf', '1 KB', 'application/pdf', now());
      INSERT INTO "Bookmark" (id, "userId", "fileId", progress, "updatedAt") VALUES ('duplicate-bookmark', 'u', 'duplicate-file', 60, now());
    `);
    await assert.rejects(db.exec(sql(latest)), /duplicate userId\/fileUrl/);
    await db.exec('ROLLBACK;');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM "Bookmark"')).rows[0].count, 2);
    const columns = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'authProvider'`);
    assert.equal(columns.rows.length, 0);
  } finally { await db.close(); }
});
