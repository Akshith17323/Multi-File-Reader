
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
      return callback(new Error("Origin is not allowed"));
    },
    exposedHeaders: ["Content-Length", "Content-Range", "Accept-Ranges"],
    allowedHeaders: ["Content-Type", "Authorization", "Range"],
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



app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.type === "entity.parse.failed" ? 400 : err.message === "Origin is not allowed" ? 403 : 500;
  res.status(status).json({ message: status === 400 ? "Invalid JSON request" : status === 403 ? err.message : "Server error" });
});

module.exports = app;