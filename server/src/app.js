import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { corsOptions, normalizedAllowedOrigin } from './config/cors.js';
import v1Routes from './routes/index.routes.js';
import { getPhase1Health } from './controllers/health.controller.js';
import { healthLimiter } from './middleware/rateLimit.middleware.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

// 0. Reverse proxy configuration (trust single front-facing proxy hop)
if (env.TRUST_PROXY !== false && env.TRUST_PROXY !== undefined) {
  app.set('trust proxy', env.TRUST_PROXY);
}

// 1. Security headers
app.use(helmet());

// 2. Origin-restricted CORS with credentials support
app.use(cors(corsOptions));

// 3. Request body & cookie parsing with size limits
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// 4. Root API metadata endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'AI Code Review API Server is running',
    version: '1.0.0',
    documentation: '/api/v1',
    health: '/api/health',
    v1Health: '/api/v1/health',
    clientUrl: normalizedAllowedOrigin
  });
});

// 5. Backward-compatible Phase 1 health check: GET /api/health
app.get('/api/health', healthLimiter, getPhase1Health);

// 6. Versioned API v1 routes: /api/v1/...
app.use('/api/v1', v1Routes);

// 6. 404 Not Found handler for unmatched routes
app.use(notFoundHandler);

// 7. Centralized Error handler
app.use(errorHandler);

export default app;
