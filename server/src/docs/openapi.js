// OpenAPI 3.0 spec for the EmbedKit examples server. Served by Swagger UI at /api/docs.
// Keep in sync with the routes in server.js and controllers/.

const error = (example) => ({
  description: example.description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: example.error } } },
});

const unauthorized = error({ description: 'Missing, invalid or expired session', error: 'unauthorized' });
const adminUnauthorized = error({ description: 'Missing or wrong `x-admin-key`', error: 'unauthorized' });
const adminDisabled = error({ description: '`ADMIN_API_KEY` is not set on the server', error: 'admin_disabled' });
const rateLimited = error({ description: 'Too many requests', error: 'rate_limited' });

const catalogIdParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,50}$' },
  example: 'hubspot',
};

const integrationIdParam = {
  name: 'integrationId',
  in: 'path',
  required: true,
  schema: { type: 'string', maxLength: 50 },
  example: 'oracle',
};

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'EmbedKit Examples API',
    version: '1.1.0',
    description:
      'Auth flow: the Genesis backend calls `POST /api/code` with its credentials, passes the one-time code to the iframe, ' +
      'and the frontend exchanges it at `POST /api/session/exchange` for a session (Bearer token + `sid` cookie).\n\n' +
      'To try session endpoints here: call `/api/code`, then `/api/session/exchange`, and paste the returned `token` into **Authorize → bearerAuth**.',
  },
  servers: [{ url: '/', description: 'This server' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth', description: 'One-time code and session' },
    { name: 'Integrations', description: "Current customer's integrations and credentials" },
    { name: 'Admin · Catalog', description: 'Global IntegrationsCatalog CRUD (requires `x-admin-key`)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Session token from /api/session/exchange' },
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'sid' },
      genesisCustomerId: { type: 'apiKey', in: 'header', name: 'x-genesis-customer-id' },
      genesisAuthToken: { type: 'apiKey', in: 'header', name: 'x-genesis-auth-token' },
      adminKey: { type: 'apiKey', in: 'header', name: 'x-admin-key', description: 'Value of ADMIN_API_KEY' },
    },
    schemas: {
      Error: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string' }, detail: { type: 'string' } },
      },
      Integration: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'oracle' },
          name: { type: 'string', example: 'Oracle Database' },
          category: { type: 'string', example: 'Database' },
          iconUrl: { type: 'string', nullable: true },
          badge: { type: 'string', nullable: true, example: 'Database' },
          isConfigured: { type: 'boolean' },
        },
      },
      CatalogItem: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'hubspot' },
          name: { type: 'string', example: 'HubSpot' },
          category: { type: 'string', example: 'CRM' },
          iconUrl: { type: 'string', nullable: true, example: 'https://cdn.simpleicons.org/hubspot' },
          badge: { type: 'string', nullable: true, example: 'CRM' },
          isGlobalActive: { type: 'boolean', example: true },
        },
      },
      CatalogCreate: {
        type: 'object',
        required: ['id', 'name', 'category'],
        properties: {
          id: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,50}$', example: 'hubspot' },
          name: { type: 'string', maxLength: 100, example: 'HubSpot' },
          category: { type: 'string', maxLength: 50, example: 'CRM' },
          iconUrl: { type: 'string', maxLength: 500, nullable: true, example: 'https://cdn.simpleicons.org/hubspot' },
          badge: { type: 'string', maxLength: 50, nullable: true, example: 'CRM' },
          isGlobalActive: { type: 'boolean', default: true },
          enableForCustomers: {
            type: 'boolean',
            default: true,
            description: 'isEnabled value of the CustomerIntegration row added for every existing customer',
          },
        },
      },
      CatalogCreated: {
        allOf: [
          { $ref: '#/components/schemas/CatalogItem' },
          {
            type: 'object',
            properties: { customersAdded: { type: 'integer', example: 12, description: 'Customers that received this integration' } },
          },
        ],
      },
      CatalogUpdate: {
        type: 'object',
        minProperties: 1,
        description: 'Only the fields sent are changed. `id` cannot be changed.',
        properties: {
          name: { type: 'string', maxLength: 100 },
          category: { type: 'string', maxLength: 50 },
          iconUrl: { type: 'string', maxLength: 500, nullable: true },
          badge: { type: 'string', maxLength: 50, nullable: true },
          isGlobalActive: { type: 'boolean' },
        },
        example: { name: 'HubSpot CRM', badge: null },
      },
    },
  },
  paths: {
    '/api/ping': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          200: { description: 'OK', content: { 'application/json': { example: { ok: true } } } },
        },
      },
    },

    '/api/code': {
      post: {
        tags: ['Auth'],
        summary: 'Issue a one-time code (server-to-server)',
        description:
          'Called by the Genesis backend. Validates the token against Genesis; creates the customer (with default integrations) on first call. ' +
          'Code is single-use and expires after `CODE_TTL_SEC` (default 60s). Rate limit: 20/min.',
        security: [{ genesisCustomerId: [], genesisAuthToken: [] }],
        responses: {
          200: {
            description: 'Code issued',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { code: { type: 'string' }, ttlSec: { type: 'integer', example: 60 } } },
              },
            },
          },
          401: error({ description: 'Genesis headers missing', error: 'Missing Genesis Credentials' }),
          403: error({ description: 'Token rejected by Genesis or does not match the stored one', error: 'Invalid Genesis API token' }),
          429: rateLimited,
          502: error({ description: 'Genesis unreachable', error: 'genesis_unreachable' }),
        },
      },
    },

    '/': {
      get: {
        tags: ['Auth'],
        summary: 'Exchange code via redirect',
        description: 'For iframes pointing directly at the API. Sets the `sid` cookie and redirects to `FRONTEND_URL`. Without `code`, falls through to other handlers.',
        parameters: [{ name: 'code', in: 'query', required: true, schema: { type: 'string' } }],
        responses: {
          302: { description: 'Session cookie set; redirect to FRONTEND_URL' },
          401: { description: 'Invalid or expired code', content: { 'text/plain': { example: 'Invalid or expired code' } } },
          429: rateLimited,
        },
      },
    },

    '/api/session/exchange': {
      post: {
        tags: ['Auth'],
        summary: 'Exchange code for a session token',
        description: 'Returns a Bearer token and also sets the `sid` cookie. `code` may be sent in the body or as `?code=`. Rate limit: 20/min.',
        requestBody: {
          content: {
            'application/json': { schema: { type: 'object', properties: { code: { type: 'string' } } } },
          },
        },
        responses: {
          200: {
            description: 'Session started',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string' },
                    tokenType: { type: 'string', example: 'Bearer' },
                    expiresIn: { type: 'integer', example: 7200 },
                    customer: { type: 'object', properties: { genesisId: { type: 'string' } } },
                  },
                },
              },
            },
          },
          401: error({ description: 'Invalid or expired code', error: 'invalid_or_expired_code' }),
          429: rateLimited,
        },
      },
    },

    '/api/session': {
      get: {
        tags: ['Auth'],
        summary: 'Current session',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: { description: 'Logged in', content: { 'application/json': { example: { ok: true, customer: { genesisId: '12345' } } } } },
          401: unauthorized,
        },
      },
      delete: {
        tags: ['Auth'],
        summary: 'Logout',
        description: 'Clears the `sid` cookie. A Bearer token stays valid until it expires.',
        responses: { 200: { description: 'Logged out', content: { 'application/json': { example: { ok: true } } } } },
      },
    },

    '/api/session/nonce': {
      post: {
        tags: ['Auth'],
        summary: 'Get an EmbedKit nonce',
        description: 'Logs in to the EmbedKit server with server-side Boomi credentials and returns a short-lived nonce.',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: {
            description: 'Nonce issued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    serverBase: { type: 'string' },
                    nonce: { type: 'string' },
                    ttlSec: { type: 'integer' },
                    tenantId: { type: 'string' },
                  },
                },
              },
            },
          },
          401: unauthorized,
          502: error({ description: 'EmbedKit server unreachable', error: 'embedkit_server_unreachable' }),
        },
      },
    },

    '/api/integrations': {
      get: {
        tags: ['Integrations'],
        summary: "List the customer's enabled integrations",
        description: 'Only integrations enabled for this customer and globally active in the catalog.',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: {
            description: 'Integrations',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Integration' } } } },
          },
          401: unauthorized,
        },
      },
    },

    '/api/credentials/{integrationId}': {
      parameters: [integrationIdParam],
      get: {
        tags: ['Integrations'],
        summary: 'Get saved credentials',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        responses: {
          200: {
            description: '`configPayload` is the stored JSON string, or null if none saved',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { configPayload: { type: 'string', nullable: true } } },
              },
            },
          },
          401: unauthorized,
        },
      },
      post: {
        tags: ['Integrations'],
        summary: 'Save credentials',
        description: 'Stores the whole body as the config payload and marks the integration as configured.',
        security: [{ bearerAuth: [] }, { cookieAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', additionalProperties: true },
              example: { apiUrl: 'https://example.com', apiUsername: 'user', apiToken: 'secret' },
            },
          },
        },
        responses: {
          200: {
            description: 'Saved',
            content: { 'application/json': { example: { success: true, message: 'Credentials saved successfully' } } },
          },
          401: unauthorized,
        },
      },
    },

    '/api/data-sync/{integrationId}': wizardStepPaths('data sync settings', {
      syncDirection: 'genesis_to_app',
      objects: ['recipes', 'ingredients'],
      syncMode: 'incremental',
      conflictResolution: 'genesis_wins',
    }),

    '/api/schedule/{integrationId}': wizardStepPaths('schedule settings', {
      enabled: true,
      frequency: 'daily',
      time: '02:00',
      dayOfWeek: 'monday',
      timezone: 'UTC',
      notifyOnFailure: true,
      notificationEmail: 'ops@example.com',
    }),

    '/api/admin/catalog': {
      get: {
        tags: ['Admin · Catalog'],
        summary: 'List catalog',
        security: [{ adminKey: [] }],
        responses: {
          200: {
            description: 'All catalog items, sorted by name',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/CatalogItem' } } } },
          },
          401: adminUnauthorized,
          503: adminDisabled,
        },
      },
      post: {
        tags: ['Admin · Catalog'],
        summary: 'Create catalog item',
        description: 'Also adds the integration to every existing customer (CustomerIntegration). New customers get every catalog item on their first code request.',
        security: [{ adminKey: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CatalogCreate' } } },
        },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/CatalogCreated' } } } },
          400: error({ description: 'Validation error', error: 'name is required' }),
          401: adminUnauthorized,
          409: error({ description: 'id already exists', error: 'id_already_exists' }),
          503: adminDisabled,
        },
      },
    },

    '/api/admin/catalog/{id}': {
      parameters: [catalogIdParam],
      get: {
        tags: ['Admin · Catalog'],
        summary: 'Get catalog item',
        security: [{ adminKey: [] }],
        responses: {
          200: { description: 'Catalog item', content: { 'application/json': { schema: { $ref: '#/components/schemas/CatalogItem' } } } },
          401: adminUnauthorized,
          404: error({ description: 'Not found', error: 'not_found' }),
          503: adminDisabled,
        },
      },
      patch: {
        tags: ['Admin · Catalog'],
        summary: 'Update catalog item',
        description: 'Partial update. Send `{ "isGlobalActive": false }` to hide it from every customer (soft delete).',
        security: [{ adminKey: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CatalogUpdate' } } },
        },
        responses: {
          200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/CatalogItem' } } } },
          400: error({ description: 'Validation error or empty body', error: 'No fields to update' }),
          401: adminUnauthorized,
          404: error({ description: 'Not found', error: 'not_found' }),
          503: adminDisabled,
        },
      },
      delete: {
        tags: ['Admin · Catalog'],
        summary: 'Delete catalog item',
        description: 'Hard delete, only allowed when no customer integration or credential references it.',
        security: [{ adminKey: [] }],
        responses: {
          204: { description: 'Deleted' },
          401: adminUnauthorized,
          404: error({ description: 'Not found', error: 'not_found' }),
          409: error({ description: 'Still in use; set isGlobalActive=false instead', error: 'in_use' }),
          503: adminDisabled,
        },
      },
    },
  },
};

// GET/POST docs for a wizard step stored as a JSON payload (data sync, schedule)
function wizardStepPaths(label, example) {
  return {
    parameters: [integrationIdParam],
    get: {
      tags: ['Integrations'],
      summary: `Get saved ${label}`,
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      responses: {
        200: {
          description: '`configPayload` is the stored JSON string, or null if none saved',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { configPayload: { type: 'string', nullable: true } } },
            },
          },
        },
        401: unauthorized,
      },
    },
    post: {
      tags: ['Integrations'],
      summary: `Save ${label}`,
      description: 'Stores the whole body as the config payload (insert or replace).',
      security: [{ bearerAuth: [] }, { cookieAuth: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', additionalProperties: true }, example } },
      },
      responses: {
        200: { description: 'Saved', content: { 'application/json': { example: { success: true } } } },
        401: unauthorized,
      },
    },
  };
}
