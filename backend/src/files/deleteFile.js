const { Storage } = require('@google-cloud/storage');
const path = require('path');

// Resolve credentials file reliably
const defaultKeyFile = path.join(__dirname, '..', 'multi-file-reader-308b489c168b.json');
const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultKeyFile;
const storage = new Storage({ keyFilename: keyFile });

const bucketName = 'multi-file-reader-storage';
const bucket = storage.bucket(bucketName);

async function deleteFile(req, res) {
    try {
        const { filename } = req.params;

        if (!filename) {
            return res.status(400).json({ message: 'Filename is required' });
        }

        const file = bucket.file(filename);
        const [exists] = await file.exists();

        if (!exists) {
            return res.status(404).json({ message: 'File not found' });
        }

        await file.delete();
        console.log(`File deleted: ${filename}`);

        return res.status(200).json({ message: 'File deleted successfully' });
    } catch (err) {
        console.error('Error deleting file:', err);
        return res.status(500).json({ message: 'Server error deleting file', error: err.message });
    }
}

module.exports = { deleteFile };
