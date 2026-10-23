const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getDocumentType, MAX_FILE_SIZE } = require('../utils/fileTypes');
const { uploadFile, addLocalFile, addDriveFile } = require('../upload/upload');
const middleware = require('../middleware/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 2, fields: 0 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'UploadingFile') {
      const type = getDocumentType(file.originalname);
      const allowed = [type, 'application/octet-stream', 'application/x-epub+zip', ''];
      if (type && allowed.includes(file.mimetype)) { file.mimetype = type; cb(null, true); }
      else cb(new Error('Only txt, epub, and pdf files are allowed for documents'), false);
    } else if (file.fieldname === 'thumbnail') {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error('Only images allowed for thumbnails'), false);
    } else {
      cb(new Error('Unexpected field: ' + file.fieldname), false);
    }
  }
});

router.post(
  '/fileUpload',
  middleware,
  (req, res, next) => upload.fields([
    { name: 'UploadingFile', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ])(req, res, (error) => {
    if (error) return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Files must be 50 MB or smaller' : error.message });
    next();
  }),
  uploadFile
);

router.post('/localUpload', middleware, addLocalFile);
router.post('/driveUpload', middleware, addDriveFile);

module.exports = router;