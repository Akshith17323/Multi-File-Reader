const express = require('express')
const multer = require('multer')
const { Storage } = require('@google-cloud/storage')

const router = express.Router()

// multer in-memory storage


const storage = new Storage({
  keyFilename: 'backend/src/multi-file-reader-308b489c168b.json'
})

const bucketName = 'multi-file-reader-bucket'
const bucket = storage.bucket(bucketName)

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