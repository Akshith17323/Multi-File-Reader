const express = require("express")

const router = express.Router()
const get_all_files = require('../files/allFiles')


router.get('/files',get_all_files)

module.exports = router

