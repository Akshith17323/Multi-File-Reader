const express = require('express')
// const multer = require('multer')
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



// async function get_all_files (req,res){
//     try {
//         const [files] = await bucket.getFiles()
//         res.status(200).json(files)
//         console.log(files)
//     }
//     catch (err){
//         console.log(err)
//         res.status(500).json({Message:"Something wrong with the server"})
//     }
// }



async function get_all_files(req, res) {
  try {
    const [files] = await bucket.getFiles();

    const fileInfos = await Promise.all(
      files.map(async (file) => {
        // get metadata
        const [meta] = await file.getMetadata().catch(() => [ {} ]);

        // ALWAYS return public GCS URL (NO signed URL)
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(file.name)}`;

        return {
          name: file.name,
          metadata: {
            size: meta.size || null,
            updated: meta.updated || null,
            contentType: meta.contentType || null
          },
          url: publicUrl
        };
      })
    );

    return res.status(200).json(fileInfos);

  } catch (err) {
    console.error('get_all_files error:', err);
    return res.status(500).json({ message: 'Server error listing files' });
  }
}

module.exports = {get_all_files}

