require('dotenv').config();
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const SECRET_KEY = process.env.JWT_SECRET || 'Rover';
const prisma = require("../prisma");
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ message: "Email required" });
    }
    if (typeof password !== "string" || !password) {
      return res.status(400).json({ message: "Password required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user_details = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user_details) {
      return res.status(404).json({ message: "User does not exist" });
    }

    if (!user_details.password) {
      return res.status(401).json({ message: "This account uses Google sign-in. Continue with Google to log in." });
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
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Name required" });
    }
    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ message: "Email required" });
    }
    if (typeof password !== "string" || !password) {
      return res.status(400).json({ message: "Password required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ message: "Enter a valid email address" });
    if (password.length < 6 || Buffer.byteLength(password, "utf8") > 72) return res.status(400).json({ message: "Password must be at least 6 characters and at most 72 bytes" });

    let existingemail = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (existingemail) {
      return res.status(409).json({ message: "Email already exists" });
    }
    const hashed_password = await bcrypt.hash(password, 10);

    const data = await prisma.user.create({ data: { name: cleanName, email: cleanEmail, password: hashed_password } });
    console.log("[Auth] Created user:", data.id);

    const token = jwt.sign(
      { userId: data.id, userName: data.name, userEmail: data.email },
      SECRET_KEY,
      { expiresIn: "14d" }
    );

    return res
      .cookie("token", token, { httpOnly: true, secure: true, sameSite: 'none' })
      .status(201)
      .json({ message: "User created successfully", user: data.name, token });
  } catch (err) {
    console.error("Signup error:", err);
    if (err.code === "P2002") return res.status(409).json({ message: "Email already exists" });
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

async function googleLogin(req, res) {
  try {
    const { token } = req.body;
    if (typeof token !== "string" || !token) return res.status(400).json({ Message: "Token required" });

    if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ message: "Google sign-in is currently unavailable" });
    let payload;
    
    try {
      // Try verifying as ID token (from standard Google button)
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      // If it fails, try using it as an access token (from custom useGoogleLogin button)
      const info = await googleClient.getTokenInfo(token);
      if (info.aud !== process.env.GOOGLE_CLIENT_ID) return res.status(401).json({ message: 'Invalid Google Token' });
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        payload = await response.json();
      }
    }

    if (!payload || !payload.email_verified || !payload.email || !payload.sub) return res.status(401).json({ Message: "Invalid Google Token" });

    const { sub: googleId, picture: avatar } = payload;
    const email = payload.email.trim().toLowerCase();
    const name = payload.name || email.split("@")[0];

    // Upsert user
    let user = await prisma.user.findUnique({ where: { email } });
    
    if (user) {
      // If user exists but used local login before, we can link the googleId
      if (!user.providerId) {
        user = await prisma.user.update({
          where: { email },
          data: { providerId: googleId, authProvider: "GOOGLE", avatar }
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          name,
          email,
          authProvider: "GOOGLE",
          providerId: googleId,
          avatar
        }
      });
    }

    const jwtToken = jwt.sign(
      { userId: user.id, userName: user.name, userEmail: user.email }, 
      SECRET_KEY, 
      { expiresIn: "14d" }
    );

    return res
      .cookie("token", jwtToken, { httpOnly: true, secure: true, sameSite: 'none' })
      .status(200).json({ message: "User Logged in", user: user.name, token: jwtToken });

  } catch (err) {
    console.error("Google Login Error:", err);
    return res.status(401).json({ message: "Google sign-in failed. Please try again." });
  }
}

module.exports = { login, signup, logout, googleLogin }