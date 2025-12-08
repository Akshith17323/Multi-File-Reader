const express = require('express')
const router = express.Router()

// Prefer global fetch (Node 18+). Fallback to node-fetch if available.
let fetchFn = globalThis.fetch
if (!fetchFn) {
  try {
    // node-fetch v2 compat; v3 is ESM-only and may not be available via require
    // this will work if node-fetch v2 is installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    fetchFn = require('node-fetch')
  } catch (e) {
    // leave fetchFn undefined and let attempts fail with a clear error
  }
}

router.options('/proxy', (req, res) => {
  const origin = process.env.FRONTEND_URL || 'http://localhost:3000'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  return res.sendStatus(204)
})

const { bucket, bucketName } = require('../gcs');

router.get('/proxy', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('missing url parameter');

  try {
    // Robustly extract object path by finding the bucket name segment
    // URL pattern: .../BUCKET_NAME/OBJECT_PATH
    const bucketSegment = `/${bucketName}/`;
    let objectPath = '';

    // Check in raw URL (decoded by Express)
    const idx = url.indexOf(bucketSegment);
    if (idx !== -1) {
      objectPath = url.substring(idx + bucketSegment.length);
    } else {
      // Try decoding again just in case of double encoding
      const decoded = decodeURIComponent(url);
      const idxDecoded = decoded.indexOf(bucketSegment);
      if (idxDecoded !== -1) {
        objectPath = decoded.substring(idxDecoded + bucketSegment.length);
      }
    }

    if (!objectPath) {
      console.warn('Proxy: Could not extract path from URL:', url);
      return res.status(400).send(`Invalid URL format. Could not find bucket segment '${bucketSegment}' in URL.`);
    }

    // Trim any leading slashes just in case
    if (objectPath.startsWith('/')) objectPath = objectPath.slice(1);

    console.log(`Proxy: Stream requested for '${objectPath}'`);

    const file = bucket.file(objectPath);

    // Skip exists() check to reduce latency and permission complexity.
    // Directly stream. GCS will error if not found.

    // We can't easily get metadata if file doesn't exist, so we might miss Content-Type 
    // if we don't do getMetadata. But getMetadata checks existence too.
    // Let's try getMetadata first, if it fails with 404, we know.

    try {
      const [metadata] = await file.getMetadata();

      const origin = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

      if (metadata.contentType) {
        res.setHeader('Content-Type', metadata.contentType);
      }
      if (metadata.size) {
        res.setHeader('Content-Length', metadata.size);
      }

      const readStream = file.createReadStream();

      readStream.on('error', (err) => {
        console.error('Proxy Stream Error:', err);
        if (!res.headersSent) {
          if (err.code === 404) {
            res.status(404).send('File not found in storage');
          } else {
            res.status(500).send('Stream error: ' + err.message);
          }
        }
      });

      readStream.pipe(res);

    } catch (metaErr) {
      console.error('Proxy Metadata Error:', metaErr);
      if (metaErr.code === 404) {
        return res.status(404).send(`File not found: ${objectPath}`);
      }
      // Proceed to try streaming anyway? No, metadata error usually means no access or no file.
      return res.status(500).send('Storage error: ' + metaErr.message);
    }

  } catch (err) {
    console.error('Proxy Critical Error:', err);
    if (!res.headersSent) res.status(500).send('Proxy critical error: ' + err.message);
  }
});

module.exports = router
