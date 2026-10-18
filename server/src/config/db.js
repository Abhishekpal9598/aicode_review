import mongoose from 'mongoose';
import { env } from './env.js';
import logger from '../utils/logger.js';

let isConnecting = false;
let isExplicitDisconnect = false;
let retryTimeout = null;
let retryCount = 0;
const MAX_RETRY_DELAY_MS = 30000;
const INITIAL_RETRY_DELAY_MS = 3000;

const stateNames = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

// Setup lifecycle event listeners once
const setupConnectionListeners = () => {
  mongoose.connection.on('connected', () => {
    retryCount = 0;
    isExplicitDisconnect = false;
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
    const host = mongoose.connection.host || 'Atlas';
    logger.info(`MongoDB connection established to ${host}`);
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err.message || err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB connection disconnected');
    if (!isExplicitDisconnect) {
      scheduleReconnect();
    }
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected successfully');
  });
};

// Schedule reconnect with exponential backoff
const scheduleReconnect = () => {
  if (isExplicitDisconnect || !env.MONGODB_URI || retryTimeout || mongoose.connection.readyState === 1 || isConnecting) {
    return;
  }

  const delay = Math.min(INITIAL_RETRY_DELAY_MS * Math.pow(1.5, retryCount), MAX_RETRY_DELAY_MS);
  retryCount++;
  logger.info(`Scheduling database reconnection attempt ${retryCount} in ${Math.round(delay / 1000)}s...`);

  retryTimeout = setTimeout(() => {
    retryTimeout = null;
    connectDB().catch((err) => {
      logger.warn('Scheduled database reconnection attempt failed:', err.message || err);
    });
  }, delay);

  if (retryTimeout.unref) {
    retryTimeout.unref();
  }
};

setupConnectionListeners();

/**
 * Connect to MongoDB Atlas. Never crashes the HTTP server on failure.
 * @returns {Promise<boolean>} true if connected, false otherwise
 */
export const connectDB = async () => {
  if (!env.MONGODB_URI) {
    logger.warn('MONGODB_URI is not configured in environment. Running in disconnected database mode.');
    return false;
  }

  // Already connected or currently connecting
  if (mongoose.connection.readyState === 1) {
    return true;
  }
  if (isConnecting) {
    return false;
  }

  isConnecting = true;
  isExplicitDisconnect = false;

  try {
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000
    };

    logger.info('Attempting MongoDB connection...');
    await mongoose.connect(env.MONGODB_URI, options);
    isConnecting = false;
    return true;
  } catch (error) {
    isConnecting = false;
    logger.error('Failed to connect to MongoDB Atlas:', error.message || error);
    scheduleReconnect();
    return false;
  }
};

/**
 * Gracefully disconnect from MongoDB.
 */
export const disconnectDB = async () => {
  isExplicitDisconnect = true;
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }

  if (mongoose.connection.readyState !== 0) {
    logger.info('Closing MongoDB connection...');
    try {
      await mongoose.connection.close(false);
      logger.info('MongoDB connection closed cleanly');
    } catch (err) {
      logger.error('Error closing MongoDB connection:', err.message || err);
    }
  }

  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
};

/**
 * Retrieve current database connection telemetry without leaking secrets.
 */
export const getDBStatus = () => {
  const readyState = mongoose.connection.readyState;
  return {
    connected: readyState === 1,
    state: stateNames[readyState] || 'unknown',
    host: readyState === 1 ? mongoose.connection.host : null
  };
};

export default {
  connectDB,
  disconnectDB,
  getDBStatus
};
