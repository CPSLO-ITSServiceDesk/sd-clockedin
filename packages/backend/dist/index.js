"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const environment_1 = require("./config/environment");
const autoClockOut_1 = require("./jobs/autoClockOut");
const routes_1 = require("./routes");
const cors_1 = require("./middleware/cors");
const errorHandler_1 = require("./middleware/errorHandler");
// Validate env before doing anything else.
(0, environment_1.loadEnvironment)();
const app = (0, express_1.default)();
// Security & parsing middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.createCorsMiddleware)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// API routes
(0, routes_1.registerRoutes)(app);
// 404 handler for unmatched routes
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});
// Centralized error handler (must be last)
app.use(errorHandler_1.errorHandler);
app.listen(environment_1.config.port, () => {
    console.log(`Server running on port ${environment_1.config.port}`);
    console.log(`Environment: ${environment_1.config.nodeEnv}`);
    console.log(`CORS allowed origins: ${environment_1.config.allowedOrigins.join(', ')}`);
    if (environment_1.config.nodeEnv === 'development') {
        console.log('CORS also allows http://localhost:* and http://127.0.0.1:*');
    }
    (0, autoClockOut_1.scheduleAutoClockOut)();
});
