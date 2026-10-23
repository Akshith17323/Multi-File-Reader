const prisma = require('../prisma');
const path = require('path');

async function registerLocalFile(req, res) {
    try {
        const userId = req.user.userId;
        const { fileName, fileUrl, fileSize, fileType } = req.body;

        if (typeof fileUrl !== "string" || !fileUrl.startsWith("mfr-local://")) {
            return res.status(400).json({ message: "fileUrl is required" });
        }

        const name = fileName || path.basename(fileUrl.replace(/^mfr-local:\/\//, '')) || 'Untitled File';
        const size = fileSize || '0 B';
        const type = fileType || 'application/octet-stream';

        // Check if file with this fileUrl already registered for this user
        const existing = await prisma.file.findFirst({
            where: {
                userId,
                fileUrl
            }
        });

        if (existing) {
            return res.status(200).json({
                message: "File already registered",
                file: {
                    id: existing.id,
                    name: existing.fileName,
                    url: existing.fileUrl,
                    metadata: {
                        size: existing.fileSize,
                        updated: existing.createdAt,
                        contentType: existing.fileType
                    }
                }
            });
        }

        // Create new File entry
        const created = await prisma.file.create({
            data: {
                userId,
                fileName: name,
                fileUrl,
                source: "LOCAL",
                fileSize: size,
                fileType: type
            }
        });

        return res.status(201).json({
            message: "Local file registered successfully",
            file: {
                id: created.id,
                name: created.fileName,
                url: created.fileUrl,
                metadata: {
                    size: created.fileSize,
                    updated: created.createdAt,
                    contentType: created.fileType
                }
            }
        });

    } catch (err) {
        console.error("[LocalFile] Error:", err);
        return res.status(500).json({ message: "Failed to register local file", error: err.message });
    }
}

module.exports = { registerLocalFile };
