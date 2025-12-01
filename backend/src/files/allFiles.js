// const express = require('express')
// // const multer = require('multer')
// const { Storage } = require('@google-cloud/storage')
// const path = require('path')

// const router = express.Router()

// // multer in-memory storage


// // Resolve credentials file reliably relative to this file, but allow
// // overriding via GOOGLE_APPLICATION_CREDENTIALS environment variable.
// const defaultKeyFile = path.join(__dirname, '..', 'multi-file-reader-308b489c168b.json')
// const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultKeyFile
// const storage = new Storage({ keyFilename: keyFile })

// const bucketName = 'multi-file-reader-storage'
// const bucket = storage.bucket(bucketName)






async function get_all_files(req, res) {
  try {
    const { search, type } = req.query;
    const [files] = await bucket.getFiles();

    let filteredFiles = files;

    // Filter by search query (case-insensitive name match)
    if (search) {
      const query = search.toLowerCase();
      filteredFiles = filteredFiles.filter(file =>
        file.name.toLowerCase().includes(query)
      );
    }

    const fileInfos = await Promise.all(
      filteredFiles.map(async (file) => {
        // get metadata
        const [meta] = await file.getMetadata().catch(() => [{}]);

        // ALWAYS return public GCS URL (NO signed URL)
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(file.name)}`;

        return {
          name: file.name,
          metadata: {
            size: meta.size || null,
            updated: meta.updated || null,
            contentType: meta.contentType || null
          },
          url: publicUrl
        };
      })
    );

    // Filter by type (after fetching metadata, as contentType is in metadata)
    // Alternatively, we could filter before if we rely on extension, but metadata is safer.
    // However, fetching metadata for ALL files just to filter might be slow.
    // Optimization: Filter by extension first if possible, or filter the result array.
    // Let's filter the result array 'fileInfos' to ensure accuracy with contentType.

    let finalFiles = fileInfos;

    if (type) {
      finalFiles = finalFiles.filter(file => {
        if (type === 'pdf') return file.metadata.contentType === 'application/pdf';
        if (type === 'epub') return file.metadata.contentType === 'application/epub+zip';
        return true;
      });
    }

    return res.status(200).json(finalFiles);

  } catch (err) {
    console.error('get_all_files error:', err);
    return res.status(500).json({ message: 'Server error listing files' });
  }
}

module.exports = { get_all_files }



const { bucket, bucketName } = require("../gcs");
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function get_all_files(req, res) {
  try {
    const { search, type } = req.query;
    const [files] = await bucket.getFiles();

    let filtered = files;

    if (search) {
      filtered = filtered.filter((f) =>
        f.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    const data = await Promise.all(
      filtered.map(async (file) => {
        const [meta] = await file.getMetadata().catch(() => [{}]);

        return {
          name: file.name,
          metadata: {
            size: meta.size ?? null,
            updated: meta.updated ?? null,
            contentType: meta.contentType ?? null,
          },
          url: `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(
            file.name
          )}`,
        };
      })
    );

    if (type === "pdf") {
      return res.json(data.filter((f) => f.metadata.contentType === "application/pdf"));
    }
    if (type === "epub") {
      return res.json(data.filter((f) => f.metadata.contentType === "application/epub+zip"));
    }

    res.json(data);
  } catch (err) {
    console.error("get_all_files error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

