const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function get_all_files(req, res) {
    try {
        const userId = req.user.userId;
        const { search, type, page = '1', limit = '10', sortBy = 'createdAt', order = 'desc' } = req.query;

        // Build where clause
        const where = {
            userId: userId,
        };

        // Add search filter
        if (search) {
            where.fileName = {
                contains: search,
                mode: 'insensitive'
            };
        }

        // Add type filter
        if (type) {
            const typeMap = {
                'pdf': 'application/pdf',
                'epub': 'application/epub+zip'
            };
            if (typeMap[type]) {
                where.fileType = typeMap[type];
            }
        }

        // Calculate pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Determine sort field
        const orderBy = {};
        if (sortBy === 'name') {
            orderBy.fileName = order;
        } else {
            orderBy.createdAt = order;
        }

        // Get total count for pagination
        const totalCount = await prisma.file.count({ where });

        // Fetch files
        const files = await prisma.file.findMany({
            where,
            orderBy,
            skip,
            take: limitNum,
        });

        // Transform to match frontend expectations
        const transformedFiles = files.map(file => ({
            id: file.id,
            name: file.fileName,
            url: file.fileUrl,
            metadata: {
                size: file.fileSize,
                updated: file.createdAt,
                contentType: file.fileType
            }
        }));

        // Return paginated response
        res.json({
            files: transformedFiles,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(totalCount / limitNum),
                totalCount: totalCount,
                limit: limitNum
            }
        });

    } catch (error) {
        console.error('❌ Error fetching files:', error);
        res.status(500).json({ error: 'Failed to fetch files' });
    }
}

module.exports = { get_all_files };