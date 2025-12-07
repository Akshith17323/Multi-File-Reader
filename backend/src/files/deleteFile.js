const { bucket } = require("../gcs");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
                fileName: filename,
                userId: userId
            }
        });

        if (!dbFile) {
            console.warn("⚠️ File not found in database or access denied");
            return res.status(404).json({ message: "File not found or access denied" });
        }

        // 2. Delete from GCS
        const file = bucket.file(filename);
        // We can check existence in GCS, but often we just try to delete. 
        // If GCS file is missing but DB has it, we should still delete from DB.
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
            // Optionally decide if we should abort or continue to delete from DB
            // Usually if GCS fail, we might want to keep DB record? 
            // Or maybe just force delete? 
            // Let's assume strict consistency is less critical than cleanup, but let's notify user.
            // For now, let's proceed to delete from DB so the user doesn't see a broken link.
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