import express from 'express';
import userRoutes from './user.js';
import authRoutes from './auth.js';

const router = express.Router();

// Auth routes
router.use(authRoutes);

// Users routes
router.use(userRoutes);

export default router;