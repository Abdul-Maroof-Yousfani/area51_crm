import express from 'express';
import { resetDatabase, migrateContacts, consolidateSources } from '../controllers/maintenance.js';

const router = express.Router();

router.post('/reset', resetDatabase);
router.post('/migrate-contacts', migrateContacts);
router.post('/consolidate-sources', consolidateSources);

export default router;
