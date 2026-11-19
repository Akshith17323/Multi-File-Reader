const prisma = require('../prisma');
const { getDocumentType, toLocalUrl } = require('../utils/fileTypes');

function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
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

module.exports = { addLocalFile, addDriveFile };
