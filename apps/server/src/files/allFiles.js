const prisma = require('../prisma');
const { toLocalUrl } = require('../utils/fileTypes');

async function get_all_files(req, res) {
    try {
        const userId = req.user.userId;
        const { search, type, page = '1', limit = '10', sortBy = 'createdAt', order = 'desc' } = req.query;

        if ((search && typeof search !== "string") || (type && typeof type !== "string") || !/^\d+$/.test(String(page)) || !/^\d+$/.test(String(limit)) || Number(page) < 1 || Number(limit) < 1 || Number(limit) > 100 || !Number.isSafeInteger(Number(page)) || !["asc", "desc"].includes(order) || !["name", "createdAt"].includes(sortBy)) {
            return res.status(400).json({ message: "Invalid search, sorting, or pagination parameters" });
        }

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
                'epub': 'application/epub+zip',
                'txt': 'text/plain'
            };
            if (typeMap[type]) {
                where.fileType = typeMap[type];
            }
        }

        // Calculate pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);


        // Determine sort field
        const orderBy = {};
        if (sortBy === 'name') {
            orderBy.fileName = order;
        } else {
            orderBy.createdAt = order;
        }

        // Get total count for pagination
        const totalCount = await prisma.file.count({ where });

        const totalPages = Math.max(1, Math.ceil(totalCount / limitNum));
        const currentPage = Math.min(pageNum, totalPages);
        const skip = (currentPage - 1) * limitNum;

        // Fetch files
        const files = await prisma.file.findMany({
            where,
            orderBy,
            skip,
            take: limitNum,
        });

        // Transform to match frontend expectations
        const transformedFiles = files.map(file => {
            let url = file.fileUrl;
            if (file.source === 'LOCAL' && file.localId) {
                url = file.fileUrl?.startsWith("mfr-local://") ? file.fileUrl : toLocalUrl(file.localId);
            } else if ((file.source === 'GOOGLE_DRIVE' || file.source === 'ONEDRIVE') && file.driveId) {
                url = `drive://${file.source}/${file.driveId}`;
            }

            return {
                id: file.id,
                name: file.fileName,
                url: url,
                thumbnailUrl: file.thumbnailUrl,
            metadata: {
                size: file.fileSize,
                updated: file.updatedAt,
                contentType: file.fileType
            }
        };
        });

        // Return paginated response
        res.json({
            files: transformedFiles,
            pagination: {
                currentPage,
                totalPages,
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