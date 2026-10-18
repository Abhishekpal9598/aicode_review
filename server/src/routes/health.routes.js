import { Router } from 'express';
import { getV1Health } from '../controllers/health.controller.js';

const router = Router();

// GET /api/v1/health
router.get('/health', getV1Health);

export default router;
