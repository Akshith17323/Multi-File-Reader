
const express = require("express");
const cors = require("cors")
const authRoutes = require('./router/authroutes')
const fileUploadRouter = require('./router/fileUpload')

const app = express();

app.use(
  cors({
    origin: [`${process.env.FRONTEND_URL}`],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials: true
  })
);
app.use(express.json());
app.use('/api/auth', authRoutes)
// mount upload router (it defines POST /fileUpload)
app.use('/', fileUploadRouter)




module.exports = app;