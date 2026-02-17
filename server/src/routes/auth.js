import express from 'express';
import { signup, login, logout, changePassword } from '../controllers/auth.js';
import { isAuthenticated } from '../middlewares/auth.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.post('/change-password', isAuthenticated, changePassword);

export default router;
