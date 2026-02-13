import express from 'express';
import userRoutes from './user.js';
import authRoutes from './auth.js';
import contactRoutes from './contact.js';
import sourcesRoutes from './sources.js';
import leadsRoutes from './leads.js';
import settingsRoutes from './settings.js';
import maintenanceRoutes from './maintenance.js';

import { isAuthenticated } from '../middlewares/auth.js';

const router = express.Router();

// Auth routes
router.use(authRoutes);

// Protect all routes below this line
router.use(isAuthenticated);

// Users routes
router.use(userRoutes);

// Contacts routes
router.use(contactRoutes);

// Sources routes
router.use(sourcesRoutes);

// Leads routes
router.use('/leads', leadsRoutes);

// Settings routes
router.use('/settings', settingsRoutes);

// Maintenance routes
router.use('/maintenance', maintenanceRoutes);

export default router;