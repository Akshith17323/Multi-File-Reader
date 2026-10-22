const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadFile, addLocalFile, addDriveFile } = require('../upload/upload');
const middleware = require('../middleware/authMiddleware');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'UploadingFile') {
      const allowed = ['text/plain', 'application/pdf', 'application/epub+zip'];
      if (allowed.includes(file.mimetype)) cb(null, true);
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
  upload.fields([
    { name: 'UploadingFile', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  uploadFile
);

router.post('/localUpload', middleware, addLocalFile);
router.post('/driveUpload', middleware, addDriveFile);

module.exports = router;