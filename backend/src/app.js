
const express = require("express");
const cors = require("cors")
const authRoutes = require('./router/authroutes')
const fileUploadRouter = require('./router/fileUpload')
const proxyRouter = require('./router/proxy')
const { get_all_files } = require('./files/allFiles')

const app = express();


// console.log('imported authRoutes:', authRoutes && typeof authRoutes)
// console.log('imported fileUploadRouter:', fileUploadRouter && typeof fileUploadRouter)
// console.log('imported get_all_files:', get_all_files && typeof get_all_files)

app.use(
  cors({
    origin: [`${process.env.FRONTEND_URL}`,`${process.env.FRONTEND_N_URL}`],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials: true
  })
);
app.use(express.json());
// proxy route to stream external resources (useful if GCS CORS can't be changed)
app.use('/', proxyRouter)
app.use('/', fileUploadRouter)
app.use('/api/auth', authRoutes)
// mount files listing as GET handler
app.get('/files', get_all_files)

// mount delete file handler
const { deleteFile } = require('./files/deleteFile')
app.delete('/files/:filename', deleteFile)

// mount upload router (it defines POST /fileUpload)



module.exports = app;