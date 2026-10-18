import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { staticAnalysisLimiter } from '../middleware/rateLimit.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { staticAnalysisSchema } from '../schemas/analysis.schema.js';
import { runStaticAnalysis } from '../controllers/analysis.controller.js';

const router = Router();

/**
 * @route   POST /api/v1/analysis/static
 * @desc    Execute deterministic static code analysis on untrusted source code
 * @access  Protected (Requires valid JWT access token)
 */
router.post(
  '/static',
  authenticate,
  staticAnalysisLimiter,
  validate(staticAnalysisSchema),
  runStaticAnalysis
);

export default router;
