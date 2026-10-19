import { Router } from 'express';
import { getV1Health } from '../controllers/health.controller.js';
import { healthLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

// GET /api/v1/health (rate limited to protect DB while allowing monitoring)
router.get('/health', healthLimiter, getV1Health);

export default router;
