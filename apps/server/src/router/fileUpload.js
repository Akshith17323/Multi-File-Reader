const express = require('express');
const router = express.Router();
const { addLocalFile, addDriveFile } = require('../upload/upload');
const middleware = require('../middleware/authMiddleware');

router.post('/localUpload', middleware, addLocalFile);
router.post('/driveUpload', middleware, addDriveFile);

module.exports = router;
