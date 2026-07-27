import path from 'path';
import { apiReference } from '@scalar/express-api-reference';
import { Application } from 'express';
import swaggerJSDoc, { OAS3Definition } from 'swagger-jsdoc';
import { responses, schemas } from './openapiSchemas';

export const docsPath = '/api/docs';
export const specPath = `${docsPath}.json`;

const definition: OAS3Definition = {
  openapi: '3.0.3',
  info: {
    title: 'SD Clock-In API',
    version: '0.1.0',
    description:
      'REST API for student assistant scheduling and time tracking. ' +
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
  components: { schemas, responses },
};

// __dirname is src/config under tsx and dist/config after a build, and tsc
// preserves the JSDoc annotations, so the same relative globs work in both.
const spec = swaggerJSDoc({
  definition,
  apis: [
    path.join(__dirname, '../routes/*.ts'),
    path.join(__dirname, '../routes/*.js'),
  ],
});

/**
 * Serves the raw spec at /api/docs.json and Scalar's renderer at /api/docs.
 * Scalar fetches its own bundle from a CDN, so no static assets need to ship
 * with the deployment — the reason it survives serverless bundling where
 * swagger-ui-express, which resolves swagger-ui-dist off disk, does not.
 * Register before helmet(), whose default CSP blocks Scalar's inline script.
 */
export function mountApiDocs(app: Application): void {
  app.get(specPath, (_req, res) => {
    res.json(spec);
  });

  app.use(
    docsPath,
    apiReference({
      url: specPath,
      pageTitle: 'SD Clock-In API',
    }),
  );
}
