const express = require('express');
const { bucket, bucketName } = require('../gcs');
const { getStorageObjectPath } = require('../utils/fileTypes');
const router = express.Router();

router.get('/proxy', async (req, res) => {
  const objectPath = getStorageObjectPath(req.query.url, bucketName);
  if (!objectPath) return res.status(400).send('A valid document URL from this storage bucket is required');
  try {
    const file = bucket.file(objectPath);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    let start = 0;
    let end = size - 1;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (!match || (!match[1] && !match[2])) return res.status(416).set('Content-Range', `bytes */${size}`).end();
      start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (start >= size || start > end) return res.status(416).set('Content-Range', `bytes */${size}`).end();
      res.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`);
    }
    res.setHeader('Content-Length', Math.max(0, end - start + 1));
    if (req.method === 'HEAD') return res.end();
    const stream = file.createReadStream(req.headers.range ? { start, end } : {});
    stream.on('error', error => {
      if (res.headersSent) res.destroy(error);
      else res.status(error.code === 404 ? 404 : 500).end('Could not read document');
    });
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  } catch (error) {
    if (!res.headersSent) res.status(error.code === 404 ? 404 : 500).send(error.code === 404 ? 'Document not found' : 'Could not read document');
  }
});

module.exports = router;
