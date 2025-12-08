const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function get_all_files(req, res) {
    try {
        const { search, type, page = 1, limit = 4, sortBy = 'createdAt', order = 'desc' } = req.query;
        const userId = req.user.userId;

        // 1. Setup the filter
        const where = {
            userId: userId
        };

        if (search) {
            where.fileName = {
                contains: search,
                mode: 'insensitive'
            };
        }

        if (type) {
            const mimeMap = {
                'pdf': 'application/pdf',
                'epub': 'application/epub+zip'
            };
            if (mimeMap[type]) {
                where.fileType = mimeMap[type];
            }
        }

        // 2. Pagination Setup
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 4;
        const skip = (pageNum - 1) * limitNum;

        // 3. Sorting Setup
        const orderBy = {};
        // Allow sorting by fileName or createdAt
        if (sortBy === 'name') orderBy.fileName = order;
        else orderBy.createdAt = order;

        // 4. Fetch Data & Count in Parallel
        const [files, total] = await prisma.$transaction([
            prisma.file.findMany({
                where,
                skip,
                take: limitNum,
                orderBy,
                include: {
                    bookmarks: {
                        where: { userId: userId },
                        select: { progress: true, total: true }
                    }
                }
            }),
            prisma.file.count({ where })
        ]);

        // 5. Map for Frontend
        const mappedFiles = files.map(file => {
            const bookmark = file.bookmarks[0]; // Should be only one due to filter
            let progressPct = 0;
            if (bookmark && bookmark.total > 0) {
                progressPct = Math.round((bookmark.progress / bookmark.total) * 100);
            }

            return {
                name: file.fileName,
                id: file.id, // Ensure ID is passed for bookmark updates
                url: file.fileUrl,
                metadata: {
                    size: file.fileSize,
                    contentType: file.fileType,
                    updated: file.createdAt,
                    progress: progressPct
                }
            };
        });

        return res.status(200).json({
            files: mappedFiles,
            pagination: {
                total,
                page: pageNum,
                totalPages: Math.ceil(total / limitNum),
                limit: limitNum
            }
        });

    } catch (err) {
        console.error('❌ get_all_files error:', err);
        return res.status(500).json({ message: 'Server error listing files' });
    }
}

module.exports = { get_all_files };