const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); // Use singleton pattern in production

async function upsertBookmark(req, res) {
    try {
        const { fileUrl, fileName, pageNumber, totalPages, cfi, progress } = req.body;
        const userId = req.user.userId;

        if (!fileUrl) {
            return res.status(400).json({ message: 'File URL is required' });
        }

        const bookmark = await prisma.bookmark.upsert({
            where: {
                userId_fileUrl: {
                    userId,
                    fileUrl
                }
            },
            update: {
                fileName: fileName || undefined, // Only update if provided
                pageNumber: pageNumber || undefined,
                totalPages: totalPages || undefined,
                cfi: cfi || undefined,
                progress: progress !== undefined ? progress : undefined,
                updatedAt: new Date()
            },
            create: {
                userId,
                fileUrl,
                fileName: fileName || 'Unknown',
                pageNumber: pageNumber || null,
                totalPages: totalPages || null,
                cfi: cfi || null,
                progress: progress || 0
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
        const { fileUrl } = req.query;
        const userId = req.user.userId;

        if (!fileUrl) {
            return res.status(400).json({ message: 'File URL is required' });
        }

        const bookmark = await prisma.bookmark.findUnique({
            where: {
                userId_fileUrl: {
                    userId,
                    fileUrl
                }
            }
        });

        if (!bookmark) {
            return res.status(200).json({ progress: 0, cfi: null, pageNumber: 1 });
        }

        return res.status(200).json(bookmark);
    } catch (error) {
        console.error('Error fetching bookmark:', error);
        return res.status(500).json({ message: 'Failed to fetch bookmark' });
    }
}

async function deleteBookmark(req, res) {
    try {
        const { fileUrl } = req.query;
        const userId = req.user.userId;

        if (!fileUrl) {
            return res.status(400).json({ message: 'File URL is required' });
        }

        // Find and delete the bookmark
        const deleted = await prisma.bookmark.deleteMany({
            where: {
                userId,
                fileUrl
            }
        });

        if (deleted.count === 0) {
            return res.status(404).json({ message: 'Bookmark not found' });
        }

        return res.status(200).json({
            message: 'Bookmark deleted successfully',
            deleted: deleted.count
        });
    } catch (error) {
        console.error('Error deleting bookmark:', error);
        return res.status(500).json({ message: 'Failed to delete bookmark' });
    }
}

async function getAllBookmarks(req, res) {
    try {
        const userId = req.user.userId;

        const bookmarks = await prisma.bookmark.findMany({
            where: { userId },
            orderBy: { lastRead: 'desc' }
        });

        return res.status(200).json({ bookmarks });
    } catch (error) {
        console.error('Error fetching all bookmarks:', error);
        return res.status(500).json({ message: 'Failed to fetch bookmarks' });
    }
}

module.exports = { upsertBookmark, getBookmark, deleteBookmark, getAllBookmarks };
