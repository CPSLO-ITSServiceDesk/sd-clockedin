import cors from 'cors';
import type { CorsOptions } from 'cors';
import { config } from '../config/environment';

const LOCAL_DEV_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function isOriginAllowed(origin: string): boolean {
  if (config.allowedOrigins.includes(origin)) {
    return true;
  }

  if (config.nodeEnv === 'development' && LOCAL_DEV_ORIGIN_PATTERN.test(origin)) {
    return true;
  }

  return false;
}

export function createCorsMiddleware() {
  const options: CorsOptions = {
    origin(origin, callback) {
      if (!origin || isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  };

  return cors(options);
}
