const express = require('express');
const router = express.Router();
const { upsertBookmark, getBookmark } = require('../bookmarks/bookmarks');
const middleware = require('../middleware/authMiddleware');

router.post('/', middleware, upsertBookmark);
router.get('/', middleware, getBookmark);

module.exports = router;
