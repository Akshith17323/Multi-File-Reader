const { bucket, bucketName } = require("../gcs");
const prisma = require('../prisma');
const { randomUUID } = require('crypto');
const { getDocumentType, toLocalUrl } = require('../utils/fileTypes');

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
        const url = `https://storage.googleapis.com/${bucketName}/${fileName.split("/").map(encodeURIComponent).join("/")}`;
        resolve(url);
      } catch (err) {
        await file.delete({ ignoreNotFound: true }).catch(() => {});
        reject(err);
      }
    });

    stream.end(fileBuffer);
  });
}

async function uploadFile(req, res) {
  const uploadedObjects = [];
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

    const docFileName = `${req.user.userId}/${randomUUID()}-${documentFile.originalname.replace(/[\\/]/g, "_")}`;
    uploadedObjects.push(docFileName);
    const docUrl = await uploadToGCS(documentFile.buffer, docFileName, documentFile.mimetype);
    console.log("✅ Document upload success. URL:", docUrl);

    let thumbnailUrl = null;
    if (thumbnailFile) {
      const thumbFileName = `${req.user.userId}/thumb-${randomUUID()}.jpg`;
      try {
        thumbnailUrl = await uploadToGCS(thumbnailFile.buffer, thumbFileName, thumbnailFile.mimetype);
        uploadedObjects.push(thumbFileName);
      } catch (error) { console.warn("Optional thumbnail upload failed:", error.message); }
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
    await Promise.allSettled(uploadedObjects.map(name => bucket.file(name).delete({ ignoreNotFound: true })));
    console.error("❌ uploadFile Error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function addLocalFile(req, res) {
  try {
    if (!req.user || !req.user.userId) return res.status(401).json({ message: "User not authenticated" });
    const { fileName, fileSize, localId, fileUrl } = req.body;
    if (!fileName || !localId) return res.status(400).json({ message: "Missing required fields" });

    if (typeof fileName !== "string" || typeof localId !== "string" || !getDocumentType(fileName)) return res.status(400).json({ message: "Choose a PDF, EPUB, or TXT file" });
    const normalizedFileUrl = fileUrl || (localId.startsWith("mfr-local://") ? localId : toLocalUrl(localId));
    if (typeof normalizedFileUrl !== 'string' || !normalizedFileUrl.startsWith('mfr-local://')) return res.status(400).json({ message: 'A local file URL is required' });
    if (fileSize !== undefined && !(typeof fileSize === 'number' && Number.isFinite(fileSize) && fileSize >= 0) && !(typeof fileSize === 'string' && /^\d+(?:\.\d+)?\s*(?:Bytes?|B|KB|MB|GB|TB|Local File)$/i.test(fileSize))) return res.status(400).json({ message: 'Invalid file size' });
    const existing = await prisma.file.findFirst({ where: { userId: req.user.userId, fileUrl: normalizedFileUrl } });
    if (existing) return res.status(200).json({ message: "Local file already added", file: existing });

    const PrismaFile = await prisma.file.create({
      data: {
        userId: req.user.userId,
        fileName,
        source: "LOCAL",
        fileUrl: normalizedFileUrl,
        localId,
        thumbnailUrl: null,
        fileType: getDocumentType(fileName),
        fileSize: typeof fileSize === 'string' ? fileSize : formatBytes(fileSize)
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
    const { fileName, fileType, fileSize, driveId, driveType, thumbnailUrl, fileUrl } = req.body;
    if (!fileName || !driveId || !driveType) return res.status(400).json({ message: "Missing required fields" });

    const normalizedFileUrl = fileUrl || `drive://${driveType}/${driveId}`;

    const PrismaFile = await prisma.file.create({
      data: {
        userId: req.user.userId,
        fileName,
        source: driveType,
        fileUrl: normalizedFileUrl,
        driveId,
        thumbnailUrl,
        fileType: getDocumentType(fileName) || fileType,
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
