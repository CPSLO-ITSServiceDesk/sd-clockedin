import express from 'express';
import helmet from 'helmet';
import { loadEnvironment, config } from './config/environment';
import { scheduleAutoClockOut } from './jobs/autoClockOut';
import { registerRoutes } from './routes';
import { createCorsMiddleware } from './middleware/cors';
import { errorHandler } from './middleware/errorHandler';

// Validate env before doing anything else.
loadEnvironment();

const app = express();

// Security & parsing middleware
app.use(helmet());
app.use(createCorsMiddleware());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
registerRoutes(app);

// 404 handler for unmatched routes
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// Centralized error handler (must be last)
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`CORS allowed origins: ${config.allowedOrigins.join(', ')}`);
  if (config.nodeEnv === 'development') {
    console.log('CORS also allows http://localhost:* and http://127.0.0.1:*');
  }
  scheduleAutoClockOut();
});
