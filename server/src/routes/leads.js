import express from 'express';
import {
    getLeads,
    getLeadById,
    createLead,
    updateLead,
    deleteLead,
    addNote,
    getLeadTimeline,
    deleteAllLeads
} from '../controllers/leads.js';

const router = express.Router();

// GET / - Get all leads
router.get('/', getLeads);

// GET /:id - Get lead by ID
router.get('/:id', getLeadById);

// POST / - Create new lead
router.post('/', createLead);

// PUT /:id - Update lead
router.put('/:id', updateLead);

// DELETE /:id - Delete lead
router.delete('/:id', deleteLead);

// POST /:id/timeline - Add note
router.post('/:id/timeline', addNote);

// GET /:id/timeline - Get timeline
router.get('/:id/timeline', getLeadTimeline);

// DELETE /all - Delete all leads
router.delete('/all', deleteAllLeads);

export default router;
