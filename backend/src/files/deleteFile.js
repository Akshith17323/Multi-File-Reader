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
    const userId = req.user.userId; // From auth middleware

    // 1. Find the file in DB to verify ownership
    const fileRecord = await prisma.file.findFirst({
      where: {
        fileName: filename,
        userId: userId
      }
    });

    if (!fileRecord) {
      return res.status(404).json({ message: "File not found or access denied" });
    }

    // 2. Delete from GCS
    // Note: If filename in DB matches GCS filename, use it.
    // If you prefixed GCS files with timestamp, ensure 'fileName' in DB matches that.
    // Based on upload.js, DB 'fileName' = req.file.originalname, but GCS file is timestamp-originalname.
    // Wait! In upload.js:
    // const fileName = Date.now() + "-" + req.file.originalname;
    // const file = bucket.file(fileName);
    // ...
    // prisma.file.create({ data: { fileName: req.file.originalname ... } })
    //
    // PROBLEM: DB stores original name, GCS stores timestamped name.
    // We can't delete from GCS if we don't know the timestamped name!
    //
    // FIX: We need to store the GCS filename in the DB too, or parse it from the URL.
    // The URL is stored in DB: fileUrl.
    // We can extract the GCS filename from the URL.

    const gcsFileName = fileRecord.fileUrl.split('/').pop();

    try {
      await bucket.file(gcsFileName).delete();
      console.log(`Deleted from GCS: ${gcsFileName}`);
    } catch (gcsErr) {
      console.warn(`Failed to delete from GCS (might be already gone): ${gcsErr.message}`);
      // Continue to delete from DB even if GCS fails (consistency)
    }

    // 3. Delete from DB
    await prisma.file.delete({
      where: {
        id: fileRecord.id
      }
    });

    res.status(200).json({ message: "File deleted successfully" });

  } catch (err) {
    console.error("deleteFile error:", err);
    res.status(500).json({ message: "Server error deleting file" });
  }
}

module.exports = { deleteFile };