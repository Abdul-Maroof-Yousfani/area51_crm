import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import prisma from '../util/prisma.js';

// Secret key for JWT (Should be in .env in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '1h';

// Joi Schemas
const signupSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    role: Joi.string().valid('Admin', 'Owner', 'Sales', 'Finance').required()
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

export const signup = async (req, res) => {
    try {
        // Validate input
        const { error, value } = signupSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ status: false, message: error.details[0].message });
        }

        const { username, email, password, role } = value;

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(409).json({ status: false, message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Create user
        const newUser = await prisma.user.create({
            data: {
                username,
                email,
                password_hash,
                role,
                is_active: true,
            },
        });

        // Generate Token
        const token = jwt.sign({ id: newUser.id, role: newUser.role }, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
        });

        // Create Session
        await prisma.sessions.create({
            data: {
                session_token: token,
                user_id: newUser.id,
                ip_address: req.ip || '0.0.0.0',
                user_agent: req.headers['user-agent'] || 'unknown',
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
                revoked_at: new Date(0), // Not revoked
            },
        });

        res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });

        return res.status(201).json({
            status: true,
            message: 'User created successfully',
            data: {
                user: {
                    id: newUser.id,
                    username: newUser.username,
                    email: newUser.email,
                    role: newUser.role,
                },
                token,
            },
        });

    } catch (error) {
        console.error('Signup Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

export const login = async (req, res) => {
    try {
        // Validate input
        const { error, value } = loginSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ status: false, message: error.details[0].message });
        }

        const { email, password } = value;

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(401).json({ status: false, message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ status: false, message: 'Invalid credentials' });
        }

        // Generate Token
        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
        });

        // Update Last Login
        await prisma.user.update({
            where: { id: user.id },
            data: { last_login_at: new Date() }
        });

        // Create Session
        await prisma.sessions.create({
            data: {
                session_token: token,
                user_id: user.id,
                ip_address: req.ip || '0.0.0.0',
                user_agent: req.headers['user-agent'] || 'unknown',
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
                revoked_at: new Date(0),
            },
        });

        res.cookie('token', token, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });

        return res.status(200).json({
            status: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                },
                token,
            },
        });

    } catch (error) {
        console.error('Login Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error', error: error.message });
    }
};

export const logout = async (req, res) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

        if (token) {
            // Revoke session
            await prisma.sessions.updateMany({
                where: { session_token: token },
                data: { revoked_at: new Date() }
            });
        }

        res.clearCookie('token');
        return res.status(200).json({ status: true, message: 'Logged out successfully' });

    } catch (error) {
        console.error('Logout Error:', error);
        return res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
};
