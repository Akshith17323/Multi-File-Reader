
const express = require("express");
require('dotenv').config(); // Ensure env vars are loaded
const cors = require("cors")
const authRoutes = require('./router/authroutes')
const fileUploadRouter = require('./router/fileUpload')
const proxyRouter = require('./router/proxy')
const { get_all_files } = require('./files/allFiles')

const app = express();

app.get('/debug-env', (req, res) => {
  const key = process.env.GCP_PRIVATE_KEY || '';
  res.json({
    project_id: process.env.GCP_PROJECT_ID,
    key_length: key.length,
    key_start: key.substring(0, 20),
    has_escaped_newlines: key.includes('\\n'),
    has_real_newlines: key.includes('\n'),
    bucket: process.env.GCP_BUCKET_NAME || 'hardcoded-in-file' // checking if they set it
  });
});


// console.log('imported authRoutes:', authRoutes && typeof authRoutes)
// console.log('imported fileUploadRouter:', fileUploadRouter && typeof fileUploadRouter)
// console.log('imported get_all_files:', get_all_files && typeof get_all_files)

app.use(
  cors({
    origin: [
      `${process.env.FRONTEND_URL}`,
      `${process.env.FRONTEND_N_URL}`,
      "https://multi-file-reader.vercel.app",
      "https://multi-file-reader-srue.vercel.app"
    ],
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