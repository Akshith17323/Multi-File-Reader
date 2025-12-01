
const express = require('express')
const router = express.Router()
const multer = require('multer')
const { uploadFile } = require('../upload/upload')

const upload = multer({
  // storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = ['text/plain', 'application/pdf', 'application/epub+zip']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('Only txt, epub, pdf files allowed'), false)
  }
})


router.post('/fileUpload', 
  (req, res, next) => {
    console.log(">>> POST /fileUpload hit");
    next();
  },
  upload.single('UploadingFile'), 
  uploadFile
)

module.exports = router