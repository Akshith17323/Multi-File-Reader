const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateFile(req, res) {
    try {
        const { id } = req.params;
        const { fileName } = req.body;
        const userId = req.user.userId;

        if (!id) {
            return res.status(400).json({ message: 'File ID is required' });
        }

        if (!fileName || fileName.trim() === '') {
            return res.status(400).json({ message: 'File name is required' });
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
            data: { fileName: fileName.trim() }
        });

        return res.status(200).json({
            message: 'File updated successfully',
            file: {
                id: updatedFile.id,
                fileName: updatedFile.fileName,
                fileUrl: updatedFile.fileUrl
            }
        });

    } catch (error) {
        console.error('❌ Update file error:', error);
        return res.status(500).json({ message: 'Failed to update file' });
    }
}

module.exports = { updateFile };
