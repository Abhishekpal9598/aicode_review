import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import { notFoundHandler } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();

// Security middleware
app.use(helmet());

// Environment-based CORS configuration with credentials support
const allowedOrigin = env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: allowedOrigin,
  credentials: true
}));

// Body parsing middleware
app.use(express.json());

// API Routes
app.use('/api', healthRoutes);

// 404 Not Found handler
app.use(notFoundHandler);

// Centralized Error handler
app.use(errorHandler);

export default app;
