const { bucket } = require("../gcs");
const path = require("path");
const prisma = require('../prisma');

async function deleteFile(req, res) {
    console.log("🚀 deleteFile handler called");
    try {
        const { filename } = req.params;
        const userId = req.user.userId;

        if (!filename) return res.status(400).json({ message: "Filename required" });

        console.log(`🗑️ Request to delete file: ${filename} for user: ${userId}`);

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
            console.warn("⚠️ File not found in database or access denied");
            return res.status(404).json({ message: "File not found or access denied" });
        }

        // 2. Delete from GCS only if it is a cloud file
        if (!dbFile.fileUrl.startsWith("mfr-local://")) {
            const gcsFileName = dbFile.fileName;
            const file = bucket.file(gcsFileName);
            try {
                const [exists] = await file.exists();
                if (exists) {
                    await file.delete();
                    console.log("✅ Deleted from GCS");
                } else {
                    console.warn("⚠️ File not found in GCS, skipping GCS delete");
                }
            } catch (gcsErr) {
                console.error("❌ Error deleting from GCS:", gcsErr);
            }
        }

        // 3. Delete from DB
        await prisma.file.delete({
            where: {
                id: dbFile.id
            }
        });
        console.log("✅ Deleted from Database");

        res.json({ message: "Deleted successfully" });

    } catch (err) {
        console.error("❌ Delete error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
}

module.exports = { deleteFile };