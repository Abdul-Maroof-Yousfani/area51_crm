import express from 'express';
import userRoutes from './user.js';
import authRoutes from './auth.js';
import contactRoutes from './contact.js';
import sourcesRoutes from './sources.js';
import leadsRoutes from './leads.js';

const router = express.Router();

// Auth routes
router.use(authRoutes);

// Users routes
router.use(userRoutes);

// Contacts routes
router.use(contactRoutes);

// Sources routes
router.use(sourcesRoutes);

// Leads routes
router.use(leadsRoutes);

export default router;