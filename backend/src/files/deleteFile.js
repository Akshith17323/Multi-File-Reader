// const { Storage } = require('@google-cloud/storage');
// const path = require('path');

// // Resolve credentials file reliably
// const defaultKeyFile = path.join(__dirname, '..', 'multi-file-reader-308b489c168b.json');
// const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultKeyFile;
// const storage = new Storage({ keyFilename: keyFile });

// const bucketName = 'multi-file-reader-storage';
// const bucket = storage.bucket(bucketName);

const { bucket } = require("../gcs");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteFile(req, res) {
  try {
    const { filename } = req.params;
    // const userId  = req.user.userId

    if (!filename) return res.status(400).json({ message: "Filename required" });

    const file = bucket.file(filename);
    const [exists] = await file.exists();

    if (!exists) return res.status(404).json({ message: "File not found" });

    await file.delete();
    res.json({ message: "Deleted successfully" });

  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

module.exports = { deleteFile };