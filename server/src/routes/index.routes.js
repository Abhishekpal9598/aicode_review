import { Router } from 'express';
import { z } from 'zod';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import analysisRoutes from './analysis.routes.js';
import reviewRoutes from './review.routes.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

// Feature routes under /api/v1
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/analysis', analysisRoutes);
router.use('/reviews', reviewRoutes);

// Dev/Test validation route to verify validate.middleware.js without business schemas
if (process.env.NODE_ENV !== 'production') {
  const testSchema = {
    body: z.object({
      sampleField: z.string({ required_error: 'sampleField is required' }).min(3)
    })
  };

  router.post('/validate-test', validate(testSchema), (req, res) => {
    res.status(200).json({ success: true, data: req.body });
  });
}

export default router;
