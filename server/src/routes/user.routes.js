import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import userController from '../controllers/user.controller.js';

const router = Router();

// GET /api/v1/users/stats - Protected by JWT authentication
router.get('/stats', authenticate, userController.getUserStats);

export default router;
