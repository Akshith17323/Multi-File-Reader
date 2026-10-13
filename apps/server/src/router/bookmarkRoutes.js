const express = require('express');
const router = express.Router();
const { upsertBookmark, getBookmark, deleteBookmark, getAllBookmarks } = require('../bookmarks/bookmarks');
const middleware = require('../middleware/authMiddleware');

router.get('/all', middleware, getAllBookmarks);
router.post('/', middleware, upsertBookmark);
router.get('/', middleware, getBookmark);
router.delete('/', middleware, deleteBookmark);

module.exports = router;
