const prisma = require('../prisma');

async function updateFile(req, res) {
    try {
        const { id } = req.params;
        const { fileName } = req.body;
        const userId = req.user.userId;

        if (!id) {
            return res.status(400).json({ message: 'File ID is required' });
        }

        const updateData = {};
        if (fileName && fileName.trim() !== '') {
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

        // Update file
        const updatedFile = await prisma.file.update({
            where: { id },
            data: updateData
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
        console.error('❌ Update file error:', error);
        return res.status(500).json({ message: 'Failed to update file' });
    }
}

module.exports = { updateFile };
