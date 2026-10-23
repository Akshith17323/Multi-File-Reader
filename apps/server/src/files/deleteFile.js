const { bucket, bucketName } = require("../gcs");
const prisma = require('../prisma');
const { getStorageObjectPath } = require('../utils/fileTypes');

async function deleteFile(req, res) {
    console.log("[Delete] deleteFile handler called");
    try {
        const { filename } = req.params;
        const userId = req.user.userId;

        if (!filename) return res.status(400).json({ message: "Filename required" });

        console.log(`[Delete] Request to delete file: ${filename} for user: ${userId}`);

        // 1. Check if file exists in DB and belongs to user
        const dbFile = await prisma.file.findFirst({
            where: {
                userId: userId,
                OR: [
                    { id: filename },
                    { fileName: filename }
                ]
            }
        });

        if (!dbFile) {
            console.warn("[Delete] File not found in database or access denied");
            return res.status(404).json({ message: "File not found or access denied" });
        }

        // Only remove objects from this application's bucket for cloud files.
        if (dbFile.source === "CLOUD") {
            const paths = [dbFile.fileUrl, dbFile.thumbnailUrl].map(url => getStorageObjectPath(url, bucketName)).filter(Boolean);
            await Promise.all(paths.map(objectPath => bucket.file(objectPath).delete({ ignoreNotFound: true })));
        }

        await prisma.$transaction(async (tx) => {
            await tx.bookmark.deleteMany({ where: { userId, OR: [{ fileId: dbFile.id }, ...(dbFile.fileUrl ? [{ fileUrl: dbFile.fileUrl }] : [])] } });
            await tx.file.delete({ where: { id: dbFile.id } });
        });
        console.log("[Delete] Deleted from Database");

        res.json({ message: "Deleted successfully" });

    } catch (err) {
        console.error("[Delete] Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
}

module.exports = { deleteFile };