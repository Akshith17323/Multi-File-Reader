const prisma = require('../prisma');
const path = require('path');

async function updateFile(req, res) {
    try {
        const { id } = req.params;
        const { fileName } = req.body;
        const userId = req.user.userId;

        if (!id) {
            return res.status(400).json({ message: 'File ID is required' });
        }

        const updateData = {};
        if (typeof fileName === 'string' && fileName.trim() !== '') {
            updateData.fileName = fileName.trim();
        }
        if (req.body.fileUrl) {
            updateData.fileUrl = req.body.fileUrl;
        }
        if (req.body.fileSize) {
            updateData.fileSize = req.body.fileSize;
        }
        if (req.body.fileType) {
            updateData.fileType = req.body.fileType;
        }

        if (Object.values(updateData).some(value => typeof value !== "string")) return res.status(400).json({ message: "File metadata must be text" });

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: 'No valid fields provided for update' });
        }

        // Verify file ownership
        const existingFile = await prisma.file.findFirst({
            where: {
                id,
                userId
            }
        });

        if (!existingFile) {
            return res.status(404).json({ message: 'File not found or access denied' });
        }

        if (updateData.fileUrl && (existingFile.source !== "LOCAL" || typeof updateData.fileUrl !== "string" || !updateData.fileUrl.startsWith("mfr-local://"))) {
            return res.status(400).json({ message: "Only local file locations can be changed" });
        }
        if (updateData.fileName) {
            const extension = path.extname(existingFile.fileName);
            if (extension && !updateData.fileName.toLowerCase().endsWith(extension.toLowerCase())) updateData.fileName += extension;
        }
        const updatedFile = await prisma.$transaction(async (tx) => {
            const updated = await tx.file.update({ where: { id }, data: updateData });
            if (existingFile.fileUrl && (updateData.fileName || updateData.fileUrl)) await tx.bookmark.updateMany({
                where: { userId, fileUrl: existingFile.fileUrl },
                data: { ...(updateData.fileName ? { fileName: updated.fileName } : {}), ...(updateData.fileUrl ? { fileUrl: updated.fileUrl } : {}) },
            });
            return updated;
        });

        return res.status(200).json({
            message: 'File updated successfully',
            file: {
                id: updatedFile.id,
                fileName: updatedFile.fileName,
                fileUrl: updatedFile.fileUrl,
                fileSize: updatedFile.fileSize,
                fileType: updatedFile.fileType
            }
        });

    } catch (error) {
        console.error('[Files] Update file error:', error);
        return res.status(500).json({ message: 'Failed to update file' });
    }
}

module.exports = { updateFile };
