const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function get_all_files(req, res) {
    try {
        const { search, type } = req.query;
        const userId = req.user.userId; // Extracted from Auth Middleware

        // 1. Setup the filter
        const where = {
            userId: userId 
        };

        // 2. Add Search logic
        if (search) {
            where.fileName = {
                contains: search,
                mode: 'insensitive' 
            };
        }

        // 3. Add Type logic
        if (type) {
             // 'application/pdf' or 'application/epub+zip'
             // If your frontend sends "pdf" (short), map it to the MIME type
             const mimeMap = {
                 'pdf': 'application/pdf',
                 'epub': 'application/epub+zip'
             };
             if (mimeMap[type]) {
                 where.fileType = mimeMap[type];
             }
        }

        // 4. Fetch from DB
        const files = await prisma.file.findMany({
            where: where,
            orderBy: {
                createdAt: 'desc' // Sort by newest first (Ensure 'createdAt' is in your schema!)
            }
        });

        // 5. Map for Frontend
        const mappedFiles = files.map(file => ({
            name: file.fileName,
            url: file.fileUrl,
            metadata: {
                size: file.fileSize, 
                contentType: file.fileType,
                // Send the date back to the frontend
                updated: file.createdAt 
            }
        }));

        return res.status(200).json(mappedFiles);

    } catch (err) {
        console.error('❌ get_all_files error:', err);
        return res.status(500).json({ message: 'Server error listing files' });
    }
}

module.exports = { get_all_files };