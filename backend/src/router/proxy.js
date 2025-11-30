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

router.get('/proxy', async (req, res) => {
  const url = req.query.url
  if (!url) return res.status(400).send('missing url parameter')

  if (!fetchFn) {
    return res.status(500).send('fetch is not available on this Node runtime; please install node-fetch or upgrade Node')
  }

  try {
    const r = await fetchFn(url)
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      return res.status(r.status).send(text || `Upstream responded ${r.status}`)
    }

    const origin = process.env.FRONTEND_URL || 'http://localhost:3000'
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')

    const contentType = r.headers && (r.headers.get ? r.headers.get('content-type') : r.headers['content-type'])
    if (contentType) res.setHeader('Content-Type', contentType)

    // Stream the response body to the client
    if (r.body && typeof r.body.pipe === 'function') {
      r.body.pipe(res)
    } else if (r.arrayBuffer) {
      // node-fetch v3 returns a Body with arrayBuffer
      const buf = Buffer.from(await r.arrayBuffer())
      res.send(buf)
    } else {
      const txt = await r.text()
      res.send(txt)
    }
  } catch (err) {
    res.status(500).send(String(err))
  }
})

module.exports = router
