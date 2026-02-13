import jwt from 'jsonwebtoken';
import prisma from '../util/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET

export const isAuthenticated = async (req, res, next) => {
    try {
        let token;

        // Check header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        // Check cookie
        else if (req.cookies.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({ status: false, message: 'Not authorized, no token' });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ status: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
            }
            if (err.name === 'JsonWebTokenError') {
                return res.status(401).json({ status: false, message: 'Invalid token', code: 'INVALID_TOKEN' });
            }
            throw err;
        }

        // Check if session is valid in DB
        const session = await prisma.sessions.findUnique({
            where: { session_token: token },
            include: { user: true }
        });

        if (!session || session.revoked_at > new Date(0) || session.expires_at < new Date()) {
            return res.status(401).json({ status: false, message: 'Session expired or revoked' });
        }

        // Attach user to request
        req.user = session.user;
        next();

    } catch (error) {
        console.error('Auth Middleware Error:', error);
        return res.status(500).json({ status: false, message: 'Server Error during authentication' });
    }
};
