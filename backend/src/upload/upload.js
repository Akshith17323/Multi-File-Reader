// const express = require('express')
// const multer = require('multer')
// const { Storage } = require('@google-cloud/storage')
// const path = require('path')

// const router = express.Router()

// // multer in-memory storage


// // Resolve credentials file reliably relative to this file, but allow
// // overriding via GOOGLE_APPLICATION_CREDENTIALS environment variable.
// const defaultKeyFile = path.join(__dirname, '..', 'multi-file-reader-308b489c168b.json')
// const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultKeyFile
// const storage = new Storage({ keyFilename: keyFile })

// const bucketName = 'multi-file-reader-storage'
// const bucket = storage.bucket(bucketName)

// // Diagnostic check: log which credentials file is used and verify the bucket exists.
// // This helps surface misconfiguration early (wrong key file, wrong project, or missing bucket).
// console.log('GCS key file (resolved):', keyFile)


const express = require("express");
const multer = require("multer");
const { bucket, bucketName } = require("../gcs");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

async function uploadFile(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: "No file" });

    const fileName = Date.now() + "-" + req.file.originalname;
    const file = bucket.file(fileName);

    const stream = file.createWriteStream({
      resumable: false,
      metadata: { contentType: req.file.mimetype },
    });

    stream.on("error", (err) => {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message });
    });

    stream.on("finish", async () => {
      await file.makePublic();

      const url = `https://storage.googleapis.com/${bucketName}/${fileName}`;

      res.status(200).json({ message: "Uploaded", url });
    });

    stream.end(req.file.buffer);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { uploadFile };
