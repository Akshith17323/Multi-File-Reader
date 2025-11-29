const express = require('express')
const multer  = require('multer')

const {Storage} = require('@google-cloud/storage')
const app  = express()


// could storage connetion

app.use(express.json())
app.use(express.urlencoded({extended:false}))

const upload = multer({
    storage:multer.memoryStorage()
})
const storage  = new Storage({
    keyFilename:"backend/src/multi-file-reader-308b489c168b.json"
})

const bucketName = "multi-file-reader-bucket"
const bucket = storage.bucket(bucketName)


// singel might be for single file uplaod make them for multiple file uploads
app.post('/fileUpload',upload.single('UploadingFile'),async (req,res)=>{
    const file = req.file
    if (!file){
        res.send(400).send({massage:"no file uploaded"})
    }
    const fileName = Date.now() + "-" + file.originalname


    const blob = bucket.file(fileName)

    const blobStream = blob.createWriteStream({
        contentType:file.mimetype
    })

    blobStream.on("error",(err)=> {
        res.status(500).send(err)
    })
    blobStream.on("finish",()=>{
        // re direct the page
        console.log("file uploaded")
        return 
    })
    blobStream.end(file.buffer)
})