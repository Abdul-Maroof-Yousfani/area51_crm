import express from 'express';
import {
    getContacts,
    getContactById,
    createContact,
    updateContact,
    deleteContact,
    deleteAllContacts
} from '../controllers/contact.js';

const router = express.Router();

// GET /contacts - Get all contacts
router.get('/contacts', getContacts);

// GET /contacts/:id - Get contact by ID
router.get('/contacts/:id', getContactById);

// POST /contacts - Create new contact
router.post('/contacts', createContact);

// PUT /contacts/:id - Update contact
router.put('/contacts/:id', updateContact);

// DELETE /contacts - Delete all contacts
router.delete('/contacts', deleteAllContacts);

// DELETE /contacts/:id - Delete contact by ID
router.delete('/contacts/:id', deleteContact);

export default router;
