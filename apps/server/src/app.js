
const express = require("express");
require('dotenv').config(); // Ensure env vars are loaded
const cors = require("cors")
const authRoutes = require('./router/authroutes')
const fileUploadRouter = require('./router/fileUpload')
const proxyRouter = require('./router/proxy')
const bookmarkRoutes = require('./router/bookmarkRoutes');
const { get_all_files } = require('./files/allFiles')
const middleware = require('./middleware/authMiddleware')

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


console.log('imported authRoutes:', authRoutes && typeof authRoutes)
console.log('imported fileUploadRouter:', fileUploadRouter && typeof fileUploadRouter)
console.log('imported get_all_files:', get_all_files && typeof get_all_files)

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_N_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://multi-file-reader.vercel.app",
  "https://multi-file-reader-srue.vercel.app"
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like Electron desktop, curl, etc.)
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  })
);
app.use(express.json());
// proxy route to stream external resources (useful if GCS CORS can't be changed)
app.use('/', proxyRouter)
app.use('/', fileUploadRouter)
app.use('/api/auth', authRoutes)
app.use('/api/bookmarks', bookmarkRoutes);
// mount files listing as GET handler
app.get('/files', middleware, get_all_files)

// mount update file handler
const { updateFile } = require('./files/updateFile')
app.patch('/files/:id', middleware, updateFile)

// mount delete file handler
const { deleteFile } = require('./files/deleteFile')
app.delete('/files/:filename', middleware, deleteFile)

// mount local file registration handler
const { registerLocalFile } = require('./files/registerLocalFile')
app.post('/files/local', middleware, registerLocalFile)

// mount upload router (it defines POST /fileUpload)



module.exports = app;