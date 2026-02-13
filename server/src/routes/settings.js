import express from 'express';
import { getSetting, updateSetting } from '../controllers/settings.js';

const router = express.Router();

router.get('/:key', getSetting);
router.post('/:key', updateSetting);

export default router;
