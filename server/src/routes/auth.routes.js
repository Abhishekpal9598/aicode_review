import { Router } from 'express';
import authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';
import { registerSchema, loginSchema, changePasswordSchema } from '../schemas/auth.schema.js';

const router = Router();

// Public Authentication Endpoints (protected by IP rate limit)
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// Authenticated Session Endpoints
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.put('/password', authenticate, validate(changePasswordSchema), authController.changePassword);

export default router;
