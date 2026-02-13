import express from 'express';
import {
    getLeads,
    getLeadById,
    createLead,
    updateLead,
    deleteLead,
    addNote,
    getLeadTimeline,
    deleteAllLeads,
    addPayment,
    deletePayment,
    importLeads
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

// DELETE /all - Delete all leads
router.delete('/all', deleteAllLeads);

// DELETE /:id - Delete lead
router.delete('/:id', deleteLead);

// POST /:id/timeline - Add note
router.post('/:id/timeline', addNote);

// GET /:id/timeline - Get timeline
router.get('/:id/timeline', getLeadTimeline);

// POST /:id/payments - Add payment
router.post('/:id/payments', addPayment);

// DELETE /:id/payments/:paymentId - Delete payment
router.delete('/:id/payments/:paymentId', deletePayment);

// POST /import - Import leads from CSV
router.post('/import', importLeads);

export default router;
