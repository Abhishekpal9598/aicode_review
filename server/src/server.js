import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import logger from './utils/logger.js';

const PORT = env.PORT || 5001;

let server;
let isShuttingDown = false;

const startServer = async () => {
  try {
    // Establish initial database connection
    try {
      await connectDB();
    } catch (err) {
      logger.warn('Initial MongoDB connection attempt returned error:', err.message || err);
    }

    server = app.listen(PORT, () => {
      logger.info(`AI Code Review API is running on port ${PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
      logger.info(`Health check (Phase 1): http://localhost:${PORT}/api/health`);
      logger.info(`Health check (Phase 2): http://localhost:${PORT}/api/v1/health`);
    });

    server.on('error', (err) => {
      logger.error('HTTP Server encountered an error:', err.message || err);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server:', error.message || error);
    process.exit(1);
  }
};

const handleGracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);

  const forceShutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out (10s). Forcing process exit.');
    process.exit(1);
  }, 10000);

  if (forceShutdownTimeout.unref) {
    forceShutdownTimeout.unref();
  }

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      logger.info('HTTP server closed successfully.');
    }

    await disconnectDB();
    logger.info('Graceful shutdown completed successfully.');
    process.exit(0);
  } catch (err) {
    logger.error('Error occurred during graceful shutdown:', err.message || err);
    process.exit(1);
  }
};

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));

startServer();

export default server;
