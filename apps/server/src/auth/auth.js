require('dotenv').config();
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const SECRET_KEY = process.env.JWT_SECRET || 'Rover';
const prisma = require("../prisma");


async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }
    if (!password) {
      return res.status(400).json({ message: "Password required" });
    }

    const user_details = await prisma.user.findUnique({ where: { email } });

    if (!user_details) {
      return res.status(404).json({ message: "User does not exist" });
    }

    const password_check = await bcrypt.compare(password, user_details.password);
    if (!password_check) {
      return res.status(401).json({ message: "Password does not match" });
    }

    const token = jwt.sign(
      { userId: user_details.id, userName: user_details.name, userEmail: user_details.email },
      SECRET_KEY,
      { expiresIn: "14d" }
    );
    return res
      .cookie("token", token, { httpOnly: true, secure: true, sameSite: 'none' })
      .status(200)
      .json({ message: "User logged in", user: user_details.name, token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      message: "Internal Server Error"
    });
  }
}

async function signup(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Name required" });
    }
    if (!email) {
      return res.status(400).json({ message: "Email required" });
    }
    if (!password) {
      return res.status(400).json({ message: "Password required" });
    }

    let existingemail = await prisma.user.findUnique({ where: { email } });

    if (existingemail) {
      return res.status(409).json({ message: "Email already exists" });
    }
    const hashed_password = await bcrypt.hash(password, 10);

    const data = await prisma.user.create({ data: { name, email, password: hashed_password } });
    console.log("Created user:", data.id);
    return res.status(201).json({ message: "User created successfully" });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

async function logout(req, res) {
  try {
    return res
      .clearCookie("token", { httpOnly: true, secure: true, sameSite: 'none' })
      .status(200)
      .json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = { login, signup, logout }