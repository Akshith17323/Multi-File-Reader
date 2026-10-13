
const express = require('express')
const router = express.Router()
const multer = require('multer')
const { uploadFile, addLocalFile, addDriveFile } = require('../upload/upload')
const middleware = require('../middleware/authMiddleware')

const upload = multer({
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'UploadingFile') {
      const allowed = ['text/plain', 'application/pdf', 'application/epub+zip']
      if (allowed.includes(file.mimetype)) cb(null, true)
      else cb(new Error('Only txt, epub, pdf files allowed for documents'), false)
    } else if (file.fieldname === 'thumbnail') {
      const allowed = ['image/jpeg', 'image/png', 'image/webp']
      if (allowed.includes(file.mimetype)) cb(null, true)
      else cb(new Error('Only images allowed for thumbnails'), false)
    } else {
      cb(new Error('Unexpected field'), false)
    }
  }
})

router.post('/fileUpload',
  middleware,
  (req, res, next) => {
    console.log(">>> POST /fileUpload hit");
    next();
  },
  upload.fields([{ name: 'UploadingFile', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),
  uploadFile
)

router.post('/localUpload', middleware, addLocalFile)
router.post('/driveUpload', middleware, addDriveFile)

module.exports = router