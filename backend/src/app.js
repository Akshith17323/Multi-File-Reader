require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

const SECRET_KEY = process.env.JWT_SECRET


const app = express();
const prisma = new PrismaClient();
app.use(
  cors({
    origin: [`${process.env.FRONTEND_URL}`],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials: true
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
      return res.status(403).json({ Message: "Password required" });
    }

    const user_details = await prisma.user.findUnique({where:{email}})
    if (user_details){
      const password_check = await bcrypt.compare(password,user_details.password)
    }
    
    // console.log(user_details)

    if (!user_details){
      return res.status(404).json({Messgae:"user does not exist"})
    }
    if(!password_check){
        return res.status(401).json({Message:"password does not match"})
    }

    const token = jwt.sign({email},SECRET_KEY)
    return res
        .cookie("token",token,{ httpOnly: true , secure : true , sameSite : 'none' })
        .status(200).json({ message:"User Loogged in"});

        // cookie parser
  } catch (err) {
    console.log(err);
  }
})


app.post('/signup',async (req, res) =>{
  try {
    const { name, email, password } = req.body;
    if (!name) {
      return res.status(403).json({ Message: "name required" });
    }
    if (!email) {
      return res.status(403).json({ Mesaage: "Email required" });
    }
    if (!password) {
      return res.status(403).json({ Message: "Paswrod required" });
    }

    let existingemail = await prisma.user.findUnique({ where: { email } });

    if (existingemail) {
      return res.status(403).json({ Message: "Email already exitis" });
    }
    const hashed_password = await bcrypt.hash(password,10)

    const data = await prisma.user.create({ data: {name, email, password:hashed_password } });
    console.log(data)
    return res.status(201).json({ Message: "User created successfully " });
  } catch (err) {
    console.log(err);
  }
}
)

module.exports = app;