
const express = require("express");
const cors = require("cors")
const authRoutes = require('./router/authroutes')
const fileUploadRouter = require('./router/fileUpload')
const { get_all_files } = require('./files/allFiles')

const app = express();


// console.log('imported authRoutes:', authRoutes && typeof authRoutes)
// console.log('imported fileUploadRouter:', fileUploadRouter && typeof fileUploadRouter)
// console.log('imported get_all_files:', get_all_files && typeof get_all_files)

app.use(
  cors({
    origin: [`${process.env.FRONTEND_URL}`],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials: true
  })
);
app.use(express.json());
app.use('/', fileUploadRouter)
app.use('/api/auth', authRoutes)
// mount files listing as GET handler
app.get('/files', get_all_files)
// mount upload router (it defines POST /fileUpload)



module.exports = app;