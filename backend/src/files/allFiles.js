const express = require('express')
// const multer = require('multer')
const { Storage } = require('@google-cloud/storage')
const path = require('path')

const router = express.Router()

// multer in-memory storage


// Resolve credentials file reliably relative to this file, but allow
// overriding via GOOGLE_APPLICATION_CREDENTIALS environment variable.
const defaultKeyFile = path.join(__dirname, '..', 'multi-file-reader-308b489c168b.json')
const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || defaultKeyFile
const storage = new Storage({ keyFilename: keyFile })

const bucketName = 'multi-file-reader-storage'
const bucket = storage.bucket(bucketName)



async function get_all_files (req,res){
    try {
        const [files] = await bucket.getFiles()
        res.status(200).json(files)
        console.log(files)
    }
    catch (err){
        console.log(err)
        res.status(500).json({Message:"Something wrong with the server"})
    }
}

module.exports = {get_all_files}