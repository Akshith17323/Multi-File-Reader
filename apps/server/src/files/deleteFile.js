const { bucket } = require("../gcs");
const prisma = require('../prisma');

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

        // 2. Delete from GCS only if it is a cloud file
        if (!dbFile.fileUrl.startsWith("mfr-local://")) {
            let gcsPath = dbFile.fileName;
            try {
                const urlObj = new URL(dbFile.fileUrl);
                const pathParts = urlObj.pathname.split('/').filter(Boolean);
                // pathParts format: [bucketName, ...objectPath]
                if (pathParts.length > 1) {
                    gcsPath = decodeURIComponent(pathParts.slice(1).join('/'));
                }
            } catch {
                gcsPath = dbFile.fileName;
            }

            const file = bucket.file(gcsPath);
            try {
                const [exists] = await file.exists();
                if (exists) {
                    await file.delete();
                    console.log(`[Delete] Deleted ${gcsPath} from GCS`);
                } else {
                    console.warn(`[Delete] File ${gcsPath} not found in GCS, skipping GCS delete`);
                }
            } catch (gcsErr) {
                console.error("[Delete] Error deleting from GCS:", gcsErr);
            }
        }

        // 3. Delete associated bookmarks first to prevent foreign key constraint failures
        try {
            await prisma.bookmark.deleteMany({
                where: {
                    OR: [
                        { fileId: dbFile.id },
                        { fileUrl: dbFile.fileUrl }
                    ]
                }
            });
        } catch (bErr) {
            console.warn("[Delete] Warning deleting associated bookmarks:", bErr);
        }

        // 4. Delete from DB
        await prisma.file.delete({
            where: {
                id: dbFile.id
            }
        });
        console.log("[Delete] Deleted from Database");

        res.json({ message: "Deleted successfully" });

    } catch (err) {
        console.error("[Delete] Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
}

module.exports = { deleteFile };