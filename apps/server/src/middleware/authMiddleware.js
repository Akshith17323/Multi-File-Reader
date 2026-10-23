require('dotenv').config();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'Rover';

async function middleware(req, res, next) {
    try {
        const header = req.headers.authorization;
        let token = null;

        if (header) {
            token = header.startsWith("Bearer ")
                ? header.split(" ")[1]
                : (header.startsWith("Bearer") ? header.substring(6).trim() : header.trim());
        } else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({
                message: "Please log in to your account",
                Message: "Please log in to your account"
            });
        }

        const verified = jwt.verify(token, JWT_SECRET);
        if (verified) {
            req.user = verified;
            return next();
        }
        return res.status(401).json({
            message: "Invalid authentication token",
            Message: "Invalid authentication token"
        });
    }
    catch (err) {
        if (['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'].includes(err.name)) {
            return res.status(401).json({
                message: "Invalid or expired token, please log in again",
                Message: "Invalid or expired token, please log in again"
            });
        }
        console.error('Authentication middleware failed:', err);
        return res.status(500).json({ message: "Authentication failed", Message: "Authentication failed" });
    }
}

module.exports = middleware;
