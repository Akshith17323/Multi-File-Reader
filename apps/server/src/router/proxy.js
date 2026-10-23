const express = require('express');
const { bucket, bucketName } = require('../gcs');
const { getStorageObjectPath } = require('../utils/fileTypes');
const router = express.Router();

function sendStorageError(res, error) {
  if (res.headersSent) return res.destroy(error);
  const code = Number(error.code);
  const billingDisabled = code === 403 && /billing.*(?:disabled|closed)/i.test(error.message || '');
  const status = billingDisabled ? 503 : code === 404 ? 404 : code === 403 ? 403 : 502;
  const message = billingDisabled
    ? 'Cloud storage is unavailable because billing is disabled for its Google Cloud project.'
    : status === 404 ? 'Document not found'
      : status === 403 ? 'Cloud storage denied access to this document'
        : 'Could not read document from cloud storage';
  // Only log the classified cause; SDK errors can contain credentials/config.
  console.error(`[Document proxy] Storage request failed (${code || 'unknown'}): ${message}`);
  // Metadata/partial-response headers must not describe the error body.
  res.removeHeader('Content-Length');
  res.removeHeader('Content-Range');
  res.removeHeader('Accept-Ranges');
  res.status(status).set('Cache-Control', 'no-store').type('text/plain').send(message);
}

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
    stream.on('error', error => sendStorageError(res, error));
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  } catch (error) {
    sendStorageError(res, error);
  }
});

module.exports = router;
