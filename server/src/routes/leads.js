import express from 'express';
import {
    getLeads,
    getLeadById,
    createLead,
    updateLead,
    deleteLead
} from '../controllers/leads.js';

const router = express.Router();

// GET /leads - Get all leads
router.get('/leads', getLeads);

// GET /leads/:id - Get lead by ID
router.get('/leads/:id', getLeadById);

// POST /leads - Create new lead
router.post('/leads', createLead);

// PUT /leads/:id - Update lead
router.put('/leads/:id', updateLead);

// DELETE /leads/:id - Delete lead
router.delete('/leads/:id', deleteLead);

export default router;
