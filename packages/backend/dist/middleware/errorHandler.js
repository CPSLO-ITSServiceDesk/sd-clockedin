"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = void 0;
exports.errorHandler = errorHandler;
/**
 * An error with an associated HTTP status code.
 * Throw this from services/controllers to control the response status.
 */
class HttpError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'HttpError';
    }
}
exports.HttpError = HttpError;
/**
 * Centralized error-handling middleware. Must be registered last,
 * after all routes. Express identifies it by its four arguments.
 */
function errorHandler(err, _req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) {
    const statusCode = err instanceof HttpError ? err.statusCode : 500;
    if (statusCode >= 500) {
        console.error(err);
    }
    res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal Server Error',
    });
}
