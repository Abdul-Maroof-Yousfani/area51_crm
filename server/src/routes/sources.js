import express from 'express';
import {
    getSources,
    getSourceById,
    createSource,
    updateSource,
    deleteSource
} from '../controllers/sources.js';

const router = express.Router();

// GET /sources - Get all sources
router.get('/sources', getSources);

// GET /sources/:id - Get source by ID
router.get('/sources/:id', getSourceById);

// POST /sources - Create new source
router.post('/sources', createSource);

// PUT /sources/:id - Update source
router.put('/sources/:id', updateSource);

// DELETE /sources/:id - Delete source by ID
router.delete('/sources/:id', deleteSource);

export default router;
