import app from './app.js';
import { env } from './config/env.js';

const PORT = env.PORT || 5001;

const server = app.listen(PORT, () => {
  console.log(`[Server] AI Code Review API is running on port ${PORT}`);
  console.log(`[Server] Environment: ${env.NODE_ENV}`);
  console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
});

export default server;
