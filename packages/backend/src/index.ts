import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { loadEnvironment, config } from './config/environment';
import { registerRoutes } from './routes';
import { errorHandler } from './middleware/errorHandler';

// Validate env before doing anything else.
loadEnvironment();

const app = express();

// Security & parsing middleware
app.use(helmet());
app.use(cors({ origin: config.frontendUrl, credentials: true }));
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
});
