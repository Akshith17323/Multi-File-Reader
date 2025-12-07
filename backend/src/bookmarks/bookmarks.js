const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); // Use singleton pattern in production

async function upsertBookmark(req, res) {
    try {
        const { fileId, progress, total, cfi } = req.body;
        const userId = req.user.userId;

        if (!fileId) {
            return res.status(400).json({ message: 'File ID is required' });
        }

        const bookmark = await prisma.bookmark.upsert({
            where: {
                userId_fileId: {
                    userId,
                    fileId
                }
            },
            update: {
                progress: progress || 0,
                total: total || 0,
                cfi: cfi || null,
                updatedAt: new Date()
            },
            create: {
                userId,
                fileId,
                progress: progress || 0,
                total: total || 0,
                cfi: cfi || null
            }
        });

        return res.status(200).json(bookmark);
    } catch (error) {
        console.error('Error saving bookmark:', error);
        return res.status(500).json({ message: 'Failed to save bookmark' });
    }
}

async function getBookmark(req, res) {
    try {
        const { fileId } = req.query; // Could also be param
        const userId = req.user.userId;

        if (!fileId) {
            return res.status(400).json({ message: 'File ID is required' });
        }

        const bookmark = await prisma.bookmark.findUnique({
            where: {
                userId_fileId: {
                    userId,
                    fileId
                }
            }
        });

        if (!bookmark) {
            // Return explicit nulls or default rather than 404 for easier frontend handling
            return res.status(200).json({ progress: 0, total: 0, cfi: null });
        }

        return res.status(200).json(bookmark);
    } catch (error) {
        console.error('Error fetching bookmark:', error);
        return res.status(500).json({ message: 'Failed to fetch bookmark' });
    }
}

module.exports = { upsertBookmark, getBookmark };
