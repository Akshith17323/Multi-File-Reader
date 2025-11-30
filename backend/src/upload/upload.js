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
  console.log(">>> uploadFile handler called");
  try {
    if (!req.file) {
      console.error("!!! No file found in req.file");
      return res.status(400).json({ message: "No file" });
    }
    console.log("File received:", req.file.originalname, "Size:", req.file.size, "Mime:", req.file.mimetype);

    const fileName = Date.now() + "-" + req.file.originalname;
    console.log("Generated filename:", fileName);
    
    const file = bucket.file(fileName);
    console.log("Created bucket file reference");

    const stream = file.createWriteStream({
      resumable: false,
      metadata: { contentType: req.file.mimetype },
    });
    console.log("Created write stream");

    stream.on("error", (err) => {
      console.error("!!! Stream Error:", err);
      res.status(500).json({ error: err.message });
    });

    stream.on("finish", async () => {
      console.log("Stream finished. Making public...");
      try {
        await file.makePublic();
        console.log("File made public.");

        const url = `https://storage.googleapis.com/${bucketName}/${fileName}`;
        console.log("Upload success. URL:", url);

        res.status(200).json({ message: "Uploaded", url });
      } catch (publicErr) {
        console.error("!!! Error making public:", publicErr);
        res.status(500).json({ error: "File uploaded but failed to make public: " + publicErr.message });
      }
    });

    console.log("Piping buffer to stream...");
    stream.end(req.file.buffer);
  } catch (err) {
    console.error("!!! uploadFile Catch Error:", err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { uploadFile };
