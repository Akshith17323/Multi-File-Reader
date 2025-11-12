const express = require("express");
const cors = require("cors");
const app = express();
const { PrismaClient } = require("@prisma/client");
const jwt = require('jsonwebtoken')
const SECRET_KEY = process.env.JWT_SECRET
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient();
app.use(
  cors({
    origin: ["http://localhost:1705", "http://localhost:5173"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials:"true"
  })
);
app.use(express.json());

app.post('/login',async (req, res) =>{
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(403).json({ Mesaage: "Email required" });
    }
    if (!password) {
      return req.status(403).json({ Message: "Password required" });
    }

    const user_details = await prisma.user.findUnique({where:{email}})
    // const password_check = await bcrypt.compare(password,user_details.password)
    console.log(user_details)

    // if(!password_check){
    //     return res.status(401).json({Message:"password does not match"})
    // }

    // const token = jwt.sign({email},SECRET_KEY)
    // return res
    //     .cookies("token",token,{ httpOnly: true })
    //     .status(200).json({ message: user_details });
  } catch (err) {
    console.log(err);
  }
})


app.post('/signup',async (req, res) =>{
  try {
    const { username, email, password } = req.body;
    if (!username) {
      return res.status(403).json({ Message: "Username required" });
    }
    if (!email) {
      return res.status(403).json({ Mesaage: "Email required" });
    }
    if (!password) {
      return req.status(403).json({ Message: "Paswrod required" });
    }

    let existingemail = await prisma.user.findUnique({ where: { email } });

    if (existingemail) {
      return res.status(403).json({ Message: "Email already exitis" });
    }
    const hashed_password = await bcrypt.hash(password,10)

    const data = await prisma.user.create({ data: { username, email, password:hashed_password } });
    console.log(data)
    return res.status(201).json({ Message: "User created successfully " });
  } catch (err) {
    console.log(err);
  }
}
)

module.exports = app;