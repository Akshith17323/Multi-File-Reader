require('dotenv').config();
const { PrismaClient } = require("@prisma/client");
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const SECRET_KEY = process.env.JWT_SECRET
const prisma = new PrismaClient();


async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(403).json({ Mesaage: "Email required" });
    }
    if (!password) {
      return res.status(403).json({ Message: "Password required" });
    }

    const user_details = await prisma.user.findUnique({ where: { email } })

    if (!user_details) {
      return res.status(404).json({ Messgae: "user does not exist" })
    }

    const password_check = await bcrypt.compare(password, user_details.password)
    if (!password_check) {
      return res.status(401).json({ Message: "password does not match" })
    }

    const token = jwt.sign({ userId: user_details.id, userName: user_details.name, userEmail: user_details.email }, SECRET_KEY, { expiresIn: "14d" })
    return res
      .cookie("token", token, { httpOnly: true, secure: true, sameSite: 'none' })
      .status(200).json({ message: "User Logged in", user: user_details.name, token });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      "error": "Internal Server Error"
    })
  }
}

async function signup(req, res) {
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
    const hashed_password = await bcrypt.hash(password, 10)

    const data = await prisma.user.create({ data: { name, email, password: hashed_password } });
    console.log(data)
    return res.status(201).json({ Message: "User created successfully " });
  } catch (err) {
    console.log(err);
  }
}

module.exports = { login, signup }