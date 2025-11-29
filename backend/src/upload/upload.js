const express = require('express')
const multer = require('multer')
const { Storage } = require('@google-cloud/storage')
const path = require('path')

const router = express.Router()

// multer in-memory storage


// Resolve credentials file reliably relative to this file, but allow
// overriding via GOOGLE_APPLICATION_CREDENTIALS environment variable.
const defaultKeyFile = path.join(__dirname, '..', 'multi-file-reader-308b489c168b.json')
const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultKeyFile
const storage = new Storage({ keyFilename: keyFile })

const bucketName = 'multi-file-reader-storage'
const bucket = storage.bucket(bucketName)

// Diagnostic check: log which credentials file is used and verify the bucket exists.
// This helps surface misconfiguration early (wrong key file, wrong project, or missing bucket).
console.log('GCS key file (resolved):', keyFile)
;(async () => {
  try {
    const [exists] = await bucket.exists()
    if (!exists) {
      console.error(`GCS bucket "${bucketName}" does not exist or is not accessible with the provided credentials.`)
      console.error('Check that the bucket name is correct, the service account has Storage permissions, and the credentials file corresponds to the right project.')
    } else {
      console.log(`GCS bucket "${bucketName}" exists and is accessible.`)
    }
  } catch (err) {
    console.error('Error while checking GCS bucket existence:', err && err.message ? err.message : err)
  }
})()

// POST /fileUpload - expects field name 'UploadingFile'
async function uploadFile (req, res) { 
  try {
    const file = req.file
    if (!file) return res.status(400).json({ message: 'No file uploaded' })

    const fileName = Date.now() + '-' + file.originalname
    const blob = bucket.file(fileName)
    

    const blobStream = blob.createWriteStream({
      resumable: false,
      metadata: {
        contentType: file.mimetype
      }
    })

    blobStream.on('error', (err) => {
      console.error('GCS upload error:', err)
      return res.status(500).json({ error: err.message })
    })

    blobStream.on('finish', async () => {
      try {
        // Make object public (optional). You can change to signed URL if preferred.
        await blob.makePublic()
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`
        console.log('file uploaded:', publicUrl)
        return res.status(200).json({ message: 'File uploaded', url: publicUrl })
      } catch (err) {
        console.error('Post-upload error:', err)
        return res.status(500).json({ error: err.message })
      }
    })

    blobStream.end(file.buffer)
  } catch (err) {
    console.error('Upload handler unexpected error:', err)
    return res.status(500).json({ error: err.message })
  }
}

module.exports = {uploadFile}