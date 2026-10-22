const { bucket, bucketName } = require("../gcs");
const prisma = require('../prisma');

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

async function uploadToGCS(fileBuffer, fileName, mimeType) {
  return new Promise((resolve, reject) => {
    const file = bucket.file(fileName);
    const stream = file.createWriteStream({
      resumable: false,
      metadata: { contentType: mimeType },
    });

    stream.on("error", (err) => reject(err));
    stream.on("finish", async () => {
      try {
        await file.makePublic();
        const url = `https://storage.googleapis.com/${bucketName}/${fileName}`;
        resolve(url);
      } catch (err) {
        reject(err);
      }
    });

    stream.end(fileBuffer);
  });
}

async function uploadFile(req, res) {
  console.log("[Upload] uploadFile handler called");
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    const files = req.files;
    const documentFile = (files && files.UploadingFile && files.UploadingFile[0]) || req.file;
    if (!documentFile) {
      console.error("❌ No document file found");
      return res.status(400).json({ message: "No document file provided" });
    }

    const thumbnailFile = files && files.thumbnail && files.thumbnail.length > 0 ? files.thumbnail[0] : null;

    console.log("📂 Document received:", documentFile.originalname, "Size:", documentFile.size);
    if (thumbnailFile) {
      console.log("🖼️ Thumbnail received:", thumbnailFile.originalname, "Size:", thumbnailFile.size);
    }

    const docFileName = `${req.user.userId}/${Date.now()}-${documentFile.originalname}`;
    const docUrl = await uploadToGCS(documentFile.buffer, docFileName, documentFile.mimetype);
    console.log("✅ Document upload success. URL:", docUrl);

    let thumbnailUrl = null;
    if (thumbnailFile) {
      const thumbFileName = `${req.user.userId}/thumb-${Date.now()}-${thumbnailFile.originalname}`;
      thumbnailUrl = await uploadToGCS(thumbnailFile.buffer, thumbFileName, thumbnailFile.mimetype);
      console.log("✅ Thumbnail upload success. URL:", thumbnailUrl);
    }

    await prisma.file.create({
      data: {
        userId: req.user.userId,
        fileName: documentFile.originalname,
        source: "CLOUD",
        fileUrl: docUrl,
        thumbnailUrl: thumbnailUrl,
        fileType: documentFile.mimetype,
        fileSize: formatBytes(documentFile.size)
      }
    });

    res.status(200).json({ message: "Uploaded", url: docUrl, thumbnailUrl });
  } catch (err) {
    console.error("❌ uploadFile Error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function addLocalFile(req, res) {
  try {
    if (!req.user || !req.user.userId) return res.status(401).json({ message: "User not authenticated" });
    const { fileName, fileType, fileSize, localId } = req.body;
    if (!fileName || !localId) return res.status(400).json({ message: "Missing required fields" });

    const PrismaFile = await prisma.file.create({
      data: {
        userId: req.user.userId,
        fileName,
        source: "LOCAL",
        localId,
        thumbnailUrl: `local-thumb://${localId}`,
        fileType,
        fileSize: formatBytes(fileSize)
      }
    });
    res.status(200).json({ message: "Local file added", file: PrismaFile });
  } catch (err) {
    console.error("❌ addLocalFile Error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function addDriveFile(req, res) {
  try {
    if (!req.user || !req.user.userId) return res.status(401).json({ message: "User not authenticated" });
    // Expect driveId, driveType ("GOOGLE_DRIVE" or "ONEDRIVE"), and optional thumbnail
    const { fileName, fileType, fileSize, driveId, driveType, thumbnailUrl } = req.body;
    if (!fileName || !driveId || !driveType) return res.status(400).json({ message: "Missing required fields" });

    const PrismaFile = await prisma.file.create({
      data: {
        userId: req.user.userId,
        fileName,
        source: driveType,
        driveId,
        thumbnailUrl,
        fileType,
        fileSize: formatBytes(fileSize)
      }
    });
    res.status(200).json({ message: "Drive file added", file: PrismaFile });
  } catch (err) {
    console.error("❌ addDriveFile Error:", err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { uploadFile, addLocalFile, addDriveFile };
