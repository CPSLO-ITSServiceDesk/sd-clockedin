"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.specPath = exports.docsPath = void 0;
exports.mountApiDocs = mountApiDocs;
const path_1 = __importDefault(require("path"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const openapiSchemas_1 = require("./openapiSchemas");
exports.docsPath = '/api/docs';
exports.specPath = `${exports.docsPath}.json`;
const definition = {
    openapi: '3.0.3',
    info: {
        title: 'SD Clock-In API',
        version: '0.1.0',
        description: 'REST API for student assistant scheduling and time tracking. ' +
            'Successful responses are wrapped as `{ success: true, data }`; ' +
            'failures return `{ success: false, error }`. The one exception is ' +
            '`POST /admins/authorize`, which returns a bare `{ allowed }` object.',
    },
    servers: [{ url: '/api', description: 'Current host' }],
    tags: [
        { name: 'System', description: 'Service health' },
        { name: 'Terms', description: 'Academic terms' },
        { name: 'Schedules', description: 'Per-student schedules within a term' },
        {
            name: 'Schedule Blocks',
            description: 'Recurring weekly shift slots inside a schedule',
        },
        { name: 'Student Assistants', description: 'Student workers' },
        { name: 'Time Entries', description: 'Clock-in and clock-out records' },
        { name: 'Shifts', description: "Today's shift board" },
        { name: 'Analytics', description: 'Punctuality metrics' },
        { name: 'Timesheet', description: 'Hours aggregation for verification' },
        {
            name: 'Normalization',
            description: 'Matching orphaned time entries to schedule blocks',
        },
        { name: 'Import', description: 'Bulk schedule import from spreadsheets' },
        { name: 'Admins', description: 'System administrators' },
    ],
    components: { schemas: openapiSchemas_1.schemas, responses: openapiSchemas_1.responses },
};
// __dirname is src/config under tsx and dist/config after a build, and tsc
// preserves the JSDoc annotations, so the same relative globs work in both.
const spec = (0, swagger_jsdoc_1.default)({
    definition,
    apis: [
        path_1.default.join(__dirname, '../routes/*.ts'),
        path_1.default.join(__dirname, '../routes/*.js'),
    ],
});
// The page Scalar's own Express middleware would return. That package is
// ESM-only, and this backend compiles to CommonJS, so requiring it aborts
// startup with ERR_REQUIRE_ESM; a dynamic import() is no escape either,
// because tsc downlevels it back into a require() under module: commonjs.
// Inlining the shell keeps the renderer with no dependency to load at all.
const docsPage = `<!doctype html>
<html>
  <head>
    <title>SD Clock-In API</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script type="text/javascript">
      Scalar.createApiReference('#app', ${JSON.stringify({ url: exports.specPath })})
    </script>
  </body>
</html>`;
/**
 * Serves the raw spec at /api/docs.json and Scalar's renderer at /api/docs.
 * Scalar pulls its bundle from a CDN, so nothing is read off disk and nothing
 * has to survive serverless file tracing. Register before helmet(), whose
 * default CSP blocks the inline script that boots the renderer.
 */
function mountApiDocs(app) {
    app.get(exports.specPath, (_req, res) => {
        res.json(spec);
    });
    app.get(exports.docsPath, (_req, res) => {
        res.type('html').send(docsPage);
    });
}
