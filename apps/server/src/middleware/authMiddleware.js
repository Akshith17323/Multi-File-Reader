require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'Rover';

async function middleware(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header) {
            return res.status(401).json({ Message: "Please log in to your account" });
        }

        const header_token = header.startsWith("Bearer ") ? header.split(" ")[1] : (header.startsWith("Bearer") ? header.substring(6).trim() : header.trim());

        if (!header_token) {
            return res.status(401).json({ Message: "Please log in to your account" });
        }

        const verified = jwt.verify(header_token, JWT_SECRET);
        if (verified) {
            req.user = verified;
            return next();
        }
        return res.status(401).json({ Message: "Invalid authentication token" });
    }
    catch (err) {
        return res.status(401).json({ Message: "Invalid or expired token, please log in again" });
    }
}

module.exports = middleware