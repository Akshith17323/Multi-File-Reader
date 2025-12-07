const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function get_all_files(req, res) {
    console.log("🚀 get_all_files handler called");
    try {
        const { search, type } = req.query;
        // req.user is populated by the authMiddleware
        const userId = req.user.userId;

        console.log(`👤 Fetching files for user: ${userId}`);

        // Build the where clause
        const where = {
            userId: userId
        };

        if (search) {
            where.fileName = {
                contains: search,
                mode: 'insensitive' // Requires Prisma feature or Postgres
            };
        }

        if (type) {
            if (type === 'pdf') {
                where.fileType = 'application/pdf';
            } else if (type === 'epub') {
                where.fileType = 'application/epub+zip';
            }
            // If other types, we could add them here or just ignore validation 
            // and let it return empty if no match
        }

        // Fetch from Database
        const files = await prisma.file.findMany({
            where: where,
            orderBy: {
                // You might want to sort by created time if available. 
                // Assuming 'createdAt' exists or similar? 
                // If not sure, we can skip orderBy or use 'id'
                // Let's assume 'id' for now or just default order
                id: 'desc'
            }
        });

        // Map to the format the frontend expects (based on previous GCS response)
        // Previous format: { name, url, metadata: { size, updated, contentType } }
        const mappedFiles = files.map(file => {
            return {
                name: file.fileName,
                url: file.fileUrl,
                metadata: {
                    size: file.fileSize, // stored as string like "10 MB" in upload.js? 
                    // Verify upload.js: fileSize: formatBytes(req.file.size) -> yes string
                    contentType: file.fileType,
                    // 'updated' might not be in DB, we can send null or createdAt if available
                    updated: null
                }
            };
        });

        console.log(`✅ Found ${mappedFiles.length} files`);
        return res.status(200).json(mappedFiles);

    } catch (err) {
        console.error('❌ get_all_files error:', err);
        return res.status(500).json({ message: 'Server error listing files' });
    }
}

module.exports = { get_all_files };
