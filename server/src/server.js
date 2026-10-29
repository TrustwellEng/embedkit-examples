import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import fetch from 'node-fetch';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '@prisma/client';
import swaggerUi from 'swagger-ui-express';
import { createAdminRouter } from './admin/routes.js';
import { openapiSpec } from './docs/openapi.js';

/* ------------ env ------------ */
const {
  PORT = 8080,
  NODE_ENV,
  JWT_SECRET,
  CORS_ORIGINS,
  COOKIE_DOMAIN,
  // Comma-separated origins of the host app (Genesis) allowed to embed this page in an iframe
  FRAME_ANCESTORS,
  // Where to redirect after exchanging a code for a session (default "/")
  FRONTEND_URL = '/',
  // One-time code TTL (seconds)
  CODE_TTL_SEC = '60',
  // Genesis GraphQL API used to validate x-genesis-auth-token
  GENESIS_API_URL = 'https://api-dev.trustwell.com/genesis',
  // Optional shared secret for scripts/Postman on /api/admin/* (sent as `x-admin-key`); the /admin UI uses admin sign-in
  ADMIN_API_KEY,
  // Serve Swagger UI at /api/docs in production too (always on outside production)
  ENABLE_API_DOCS,
  // Sales demo: opening the app with ?code=<DEMO_CODE> starts a session for the "demo" customer
  // without Genesis. Defaults to "demo" in every environment; set DEMO_CODE=off to disable it.
  DEMO_CODE,
  EMBEDKIT_SERVER_BASE,
  API_URL,
  API_ACCOUNT_ID,
  API_USERNAME,
  API_TOKEN,
  API_AUTH_USER,
  API_ACCOUNT_GROUP,
  DB_SERVER,
  DB_PORT = '1433',
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_ENCRYPT = 'true',
  DB_TRUST_SERVER_CERTIFICATE = 'false',
} = process.env;

if (!DB_SERVER || !DB_NAME || !DB_USER || !DB_PASSWORD) {
  throw new Error('Missing DB_SERVER, DB_NAME, DB_USER, or DB_PASSWORD');
}
if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET');
}

const isProd = NODE_ENV === 'production';
const splitList = (s) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const ALLOW_ORIGINS = new Set(splitList(CORS_ORIGINS));
const FRAME_ANCESTOR_LIST = splitList(FRAME_ANCESTORS);

/* ------------ db ------------ */
const adapter = new PrismaMssql({
  server: DB_SERVER,
  port: Number(DB_PORT),
  database: DB_NAME,
  user: DB_USER,
  password: DB_PASSWORD,
  options: {
    encrypt: DB_ENCRYPT !== 'false',
    trustServerCertificate: DB_TRUST_SERVER_CERTIFICATE === 'true',
  },
});
const prisma = new PrismaClient({ adapter });

try {
  await prisma.$queryRaw`SELECT 1`;
  console.log('[db] connected');
} catch (e) {
  console.error('[db] connect failed:', e?.message || e);
}

/* ------------ app ------------ */
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Allow the host app (Genesis) to embed this page in an iframe.
// Note: this header only applies to responses from this server. If the frontend is
// served elsewhere (nginx, CDN...), frame-ancestors must be set there too.
app.use(
  helmet({
    frameguard: false, // disable X-Frame-Options, use CSP frame-ancestors instead
    contentSecurityPolicy: false, // set manually below (newer helmet requires default-src)
    crossOriginResourcePolicy: { policy: 'same-site' },
  })
);
app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${FRAME_ANCESTOR_LIST.join(' ')}`.trim());
  next();
});
app.use(morgan(isProd ? 'combined' : 'tiny'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

/* ------------ CORS (multi-origin, credentialed) ------------ */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOW_ORIGINS.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Headers',
    isProd
      ? 'Content-Type, Authorization'
      : 'Content-Type, Authorization, x-genesis-customer-id, x-genesis-auth-token' // dev: lets the test login form call /api/code
  );
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ------------ rate limit ------------ */
function makeLimiter(points, duration) {
  const limiter = new RateLimiterMemory({ points, duration });
  return async (req, res, next) => {
    try {
      await limiter.consume(req.ip);
      next();
    } catch {
      res.status(429).json({ error: 'rate_limited' });
    }
  };
}
app.use(makeLimiter(100, 60));
const strictLimiter = makeLimiter(20, 60); // for /api/code and /?code=

/* ------------ cookie + session helpers ------------ */
// Cross-site iframe => production needs SameSite=None; Secure; Partitioned (CHIPS)
// so it still works when the browser blocks third-party cookies.
// Dev (localhost) is same-site, so lax is fine.
// If your Express/cookie version doesn't support `partitioned`, the option is ignored.
function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    partitioned: isProd,
    path: '/',
    domain: COOKIE_DOMAIN || undefined,
  };
}

const SESSION_TTL_SEC = 2 * 60 * 60;

// Which host app the page was opened from: Genesis (GF, default) or Food LogiQ (FLQ).
// Comes from ?source= on the iframe URL, is fixed at code exchange and kept in the session token.
const SOURCES = new Set(['GF', 'FLQ']);
const DEFAULT_SOURCE = 'GF';

// Missing -> GF; unknown value -> null (caller returns 400)
function parseSource(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_SOURCE;
  const source = String(value).toUpperCase();
  return SOURCES.has(source) ? source : null;
}

// Returns a session token and also sets the `sid` cookie.
// - Browsers allowing third-party cookies (Chrome/CHIPS): use the cookie.
// - Safari / iframes with blocked cookies, Postman: send the token via `Authorization: Bearer <token>`.
function startSession(res, customer, source) {
  const token = jwt.sign({ sub: customer.genesisId, src: source }, JWT_SECRET, { expiresIn: SESSION_TTL_SEC });
  res.cookie('sid', token, { ...cookieOptions(), maxAge: SESSION_TTL_SEC * 1000 });
  return token;
}

function readSessionToken(req) {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return req.cookies?.sid;
}

// Session obtained from a code -> load the customer from the DB on every request
async function requireSession(req, res, next) {
  const token = readSessionToken(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  let claims;
  try {
    claims = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const customer = await prisma.customer.findUnique({ where: { genesisId: String(claims.sub) } });
    if (!customer) return res.status(401).json({ error: 'unauthorized' });
    req.customer = customer;
    // Tokens issued before the source flag existed have no `src` -> GF
    req.source = SOURCES.has(claims.src) ? claims.src : DEFAULT_SOURCE;
    next();
  } catch (error) {
    console.error('requireSession error:', error);
    res.status(500).json({ error: 'Database error' });
  }
}

/* ------------ one-time code store ------------ */
// In-memory: only correct with a single instance. When scaling out, move to
// Redis (SET code EX 60 NX + GETDEL) or a DB table with an expiresAt column.
const CODE_TTL_MS = Number(CODE_TTL_SEC) * 1000;
const codeStore = new Map(); // code -> { genesisId, expiresAt }

function issueCode(genesisId) {
  const code = crypto.randomBytes(32).toString('base64url');
  codeStore.set(code, { genesisId, expiresAt: Date.now() + CODE_TTL_MS });
  return code;
}

// Single use: delete on read, even if already expired
function consumeCode(code) {
  const entry = codeStore.get(code);
  if (!entry) return null;
  codeStore.delete(code);
  return entry.expiresAt >= Date.now() ? entry : null;
}

setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of codeStore) {
    if (entry.expiresAt < now) codeStore.delete(code);
  }
}, 30_000).unref();

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/* ------------ Genesis token validation (only used by POST /api/code) ------------ */
const DEFAULT_INTEGRATIONS = [
  { integrationId: 'netsuite', isEnabled: true },
  { integrationId: 'oracle', isEnabled: true },
  { integrationId: 'sap_s4hana', isEnabled: true },
  { integrationId: 'slack_integration', isEnabled: true },
];

// Minimal query that only succeeds with a valid Genesis API key
const GENESIS_VALIDATE_QUERY = {
  query: `
    query($input: FoodSearchInput!) {
      foods {
        search(input: $input) {
          foodSearchResults { id name }
        }
      }
    }
  `,
  variables: {
    input: {
      searchText: '',
      foodTypes: ['Recipe'],
      itemSourceFilter: 'Customer',
      versionFilter: 'Latest',
      documentStatusFilter: 'All',
      archiveFilter: 'Unarchived',
      first: 1,
      after: 0,
    },
  },
};

// Returns true if Genesis accepts the token, false if it rejects it.
// Throws when Genesis is unreachable or returns an unexpected error.
async function validateGenesisToken(authToken) {
  const r = await fetch(GENESIS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': String(authToken) },
    body: JSON.stringify(GENESIS_VALIDATE_QUERY),
    signal: AbortSignal.timeout(10_000),
  });

  if (r.status === 401 || r.status === 403) return false;
  if (!r.ok) throw new Error(`Genesis API responded ${r.status}`);

  const body = await r.json().catch(() => null);
  if (body?.errors?.length) {
    console.warn('Genesis token validation returned GraphQL errors:', JSON.stringify(body.errors).slice(0, 500));
    return false;
  }
  return true;
}

// Give a customer every catalog integration it doesn't have yet (enabled, not configured).
// Covers catalog rows inserted directly in the DB and customers created mid catalog insert.
async function addMissingIntegrations(customerId) {
  return prisma.$executeRaw`
    INSERT INTO CustomerIntegration (customerId, integrationId, isEnabled, isConfigured)
    SELECT ${customerId}, c.id, 1, 0
    FROM IntegrationsCatalog c
    WHERE NOT EXISTS (
      SELECT 1 FROM CustomerIntegration ci
      WHERE ci.customerId = ${customerId} AND ci.integrationId = c.id
    )`;
}

async function genesisAuth(req, res, next) {
  const customerId = req.headers['x-genesis-customer-id'];
  const authToken = req.headers['x-genesis-auth-token'];

  if (!customerId || !authToken) {
    return res.status(401).json({ error: 'Missing Genesis Credentials' });
  }

  try {
    if (!(await validateGenesisToken(authToken))) {
      return res.status(403).json({ error: 'Invalid Genesis API token' });
    }
  } catch (error) {
    console.error('Genesis token validation failed:', error?.message || error);
    return res.status(502).json({ error: 'genesis_unreachable' });
  }

  try {
    const genesisId = String(customerId);
    let customer = await prisma.customer.findUnique({ where: { genesisId } });

    if (!customer) {
      // First request for this customer: token was validated by Genesis above
      customer = await prisma.customer.create({
        data: { genesisId, genesisAuthToken: String(authToken) },
      });
      await prisma.customerIntegration.createMany({
        data: DEFAULT_INTEGRATIONS.map((i) => ({ customerId: customer.id, isConfigured: false, ...i })),
      });
    } else if (!safeEqual(customer.genesisAuthToken, authToken)) {
      return res.status(403).json({ error: 'Invalid Genesis Authentication' });
    }

    try {
      await addMissingIntegrations(customer.id);
    } catch (error) {
      // Not fatal: a concurrent request may have inserted the same rows
      console.warn('addMissingIntegrations failed:', error?.message || error);
    }

    req.customer = customer;
    next();
  } catch (error) {
    console.error('genesisAuth error:', error);
    res.status(500).json({ error: 'Database error' });
  }
}

/* ------------ routes ------------ */

// Health
app.get('/api/ping', (_req, res) => res.json({ ok: true }));

// API docs (Swagger UI) + raw OpenAPI spec
if (!isProd || ENABLE_API_DOCS === 'true') {
  app.get('/api/docs.json', (_req, res) => res.json(openapiSpec));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { swaggerOptions: { persistAuthorization: true } }));
}

// (1) Server-to-server: host backend sends the real token, receives a single-use code (~60s)
app.post('/api/code', strictLimiter, genesisAuth, (req, res) => {
  const code = issueCode(req.customer.genesisId);
  res.set('Cache-Control', 'no-store');
  res.json({ code, ttlSec: Number(CODE_TTL_SEC) });
});

/* ------------ sales demo customer ------------ */
const DEMO_LOGIN_CODE = DEMO_CODE === 'off' ? null : DEMO_CODE || 'demo';
// One demo customer per product, since Genesis and FoodLogiQ customers are separate:
// ?code=demo (or &source=GF) -> "demo", ?code=demo&source=FLQ -> "demo-flq"
const DEMO_CUSTOMERS = {
  GF: { genesisId: 'demo', customerName: 'Demo (Sales, Genesis)' },
  FLQ: { genesisId: 'demo-flq', customerName: 'Demo (Sales, FoodLogiQ)' },
};

// Find or create the product's demo customer. It has a random Genesis token, so it can never
// authenticate through Genesis; the demo code is the only way in.
async function getDemoCustomer(source) {
  const { genesisId, customerName } = DEMO_CUSTOMERS[source] ?? DEMO_CUSTOMERS[DEFAULT_SOURCE];
  let customer = await prisma.customer.findUnique({ where: { genesisId } });
  if (!customer) {
    try {
      customer = await prisma.customer.create({
        data: {
          genesisId,
          customerName,
          genesisAuthToken: crypto.randomBytes(32).toString('hex'),
        },
      });
    } catch (err) {
      // Two demo logins at the same time: the other request created it
      if (err?.code !== 'P2002') throw err;
      customer = await prisma.customer.findUnique({ where: { genesisId } });
    }
  }
  await addMissingIntegrations(customer.id).catch((e) => console.warn('demo addMissingIntegrations failed:', e?.message || e));
  return customer;
}

// Exchange code -> customer (shared by GET /?code= and POST /api/session/exchange)
async function exchangeCode(code, source) {
  if (typeof code !== 'string' || !code) return null;
  // Reusable (not single-use) so Sales can open the same link any number of times
  if (DEMO_LOGIN_CODE && safeEqual(code, DEMO_LOGIN_CODE)) return getDemoCustomer(source);
  const entry = consumeCode(code);
  if (!entry) return null;
  return prisma.customer.findUnique({ where: { genesisId: entry.genesisId } });
}

// (2a) Iframe/web pointing directly at the API: GET /?code=... -> delete code, set cookie, redirect to FRONTEND_URL
app.get('/', strictLimiter, async (req, res, next) => {
  const { code } = req.query;
  if (typeof code !== 'string' || !code) return next(); // no code: let the frontend/other routes handle it

  res.set('Cache-Control', 'no-store');
  const source = parseSource(req.query.source);
  if (!source) return res.status(400).send('Invalid source');
  try {
    const customer = await exchangeCode(code, source);
    if (!customer) return res.status(401).send('Invalid or expired code');

    startSession(res, customer, source);
    // Redirect so the code drops out of the URL
    return res.redirect(302, FRONTEND_URL);
  } catch (error) {
    console.error('code exchange error:', error);
    return res.status(500).send('Server error');
  }
});

// (2b) Frontend (iframe or regular tab) / Postman: POST { code } -> session token (+ cookie)
// The frontend is served from another host (nginx), so it reads ?code= and calls this endpoint.
app.post('/api/session/exchange', strictLimiter, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  // Checked before the code is consumed so a bad source doesn't burn the code
  const source = parseSource(req.body?.source ?? req.query.source);
  if (!source) return res.status(400).json({ error: 'invalid_source' });
  try {
    const customer = await exchangeCode(req.body?.code ?? req.query.code, source);
    if (!customer) return res.status(401).json({ error: 'invalid_or_expired_code' });

    const token = startSession(res, customer, source);
    return res.json({
      token,
      tokenType: 'Bearer',
      expiresIn: SESSION_TTL_SEC,
      source,
      customer: { genesisId: customer.genesisId },
    });
  } catch (error) {
    console.error('code exchange error:', error);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Current session
app.get('/api/session', requireSession, (req, res) => {
  res.json({ ok: true, source: req.source, customer: { genesisId: req.customer.genesisId } });
});

// Logout
app.delete('/api/session', (_req, res) => {
  res.clearCookie('sid', cookieOptions());
  res.json({ ok: true });
});

// Get an EmbedKit nonce for the current session (server-to-server, secrets never reach the browser)
app.post('/api/session/nonce', requireSession, async (req, res) => {
  const boomiPayload = {
    url: API_URL,
    parentAccountId: API_ACCOUNT_ID,
    apiUserName: API_USERNAME,
    apiToken: API_TOKEN,
    childAccountId: API_AUTH_USER || undefined,
    accountGroup: API_ACCOUNT_GROUP || undefined,
  };

  try {
    const r = await fetch(`${EMBEDKIT_SERVER_BASE}/auth/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: req.headers.origin || '',
        'X-Tenant-Id': API_ACCOUNT_ID || '',
      },
      body: JSON.stringify(boomiPayload),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error('EmbedKit Server login failed:', r.status, errText);
      return res.status(r.status).json({ error: 'embedkit_server_login_failed', detail: errText });
    }
    const { nonce, ttlSec } = await r.json();
    return res.json({ serverBase: EMBEDKIT_SERVER_BASE, nonce, ttlSec, tenantId: API_ACCOUNT_ID });
  } catch (e) {
    console.error('Error connecting to EmbedKit Server:', e);
    return res.status(502).json({ error: 'embedkit_server_unreachable' });
  }
});

/* ------------ integrations (session-authenticated, no Genesis headers/query) ------------ */
app.get('/api/integrations', requireSession, async (req, res) => {
  const { source } = req;
  try {
    // Customer-disabled apps are returned too (shown greyed out); globally inactive or source-hidden ones are not
    const availableApps = await prisma.customerIntegration.findMany({
      where: {
        customerId: req.customer.id,
        integration: { isGlobalActive: true, sourceInfos: { none: { source, isActive: false } } },
      },
      include: { integration: { include: { sourceInfos: { where: { source } } } } },
    });

    res.json(
      availableApps.map(({ integration, isEnabled, isConfigured }) => {
        // Per-source info overrides the catalog; null fields fall back to it
        const info = integration.sourceInfos[0] || {};
        return {
          id: integration.id,
          name: info.name ?? integration.name,
          category: info.category ?? integration.category,
          iconUrl: info.iconUrl ?? integration.iconUrl,
          badge: info.badge ?? integration.badge,
          isConfigured,
          status: integration.isComingSoon
            ? 'coming_soon'
            : !isEnabled
              ? 'disabled'
              : isConfigured
                ? 'connected'
                : 'not_connected',
        };
      })
    );
  } catch (error) {
    console.error('Failed to load integrations:', error);
    res.status(500).json({ error: 'Failed to load integrations' });
  }
});

// Integration must be enabled for this customer, globally active, released and not hidden for the session's source
async function requireIntegration(req, res, next) {
  try {
    const found = await prisma.customerIntegration.findFirst({
      where: {
        customerId: req.customer.id,
        integrationId: req.params.integrationId,
        isEnabled: true,
        integration: { isGlobalActive: true, isComingSoon: false, sourceInfos: { none: { source: req.source, isActive: false } } },
      },
      select: { integrationId: true },
    });
    if (!found) return res.status(404).json({ error: 'integration_not_found' });
    next();
  } catch (error) {
    console.error('requireIntegration error:', error);
    res.status(500).json({ error: 'Failed to load integration' });
  }
}

app.post('/api/credentials/:integrationId', requireSession, requireIntegration, async (req, res) => {
  const { integrationId } = req.params;
  try {
    const configPayload = JSON.stringify(req.body);

    const existing = await prisma.connectionCredential.findFirst({
      where: { customerId: req.customer.id, integrationId },
    });

    if (existing) {
      // Customer/system writes clear modifiedBy (it only names an admin when an admin made the change)
      await prisma.connectionCredential.update({ where: { id: existing.id }, data: { configPayload, modifiedBy: null } });
    } else {
      await prisma.connectionCredential.create({
        data: { customerId: req.customer.id, integrationId, configPayload },
      });
    }

    await prisma.customerIntegration.update({
      where: { customerId_integrationId: { customerId: req.customer.id, integrationId } },
      data: { isConfigured: true, modifiedBy: null },
    });

    res.json({ success: true, message: 'Credentials saved successfully' });
  } catch (error) {
    console.error('Failed to save credentials:', error);
    res.status(500).json({ error: 'Failed to save credentials' });
  }
});

app.get('/api/credentials/:integrationId', requireSession, requireIntegration, async (req, res) => {
  const { integrationId } = req.params;
  try {
    const credential = await prisma.connectionCredential.findFirst({
      where: { customerId: req.customer.id, integrationId },
    });
    res.json({ configPayload: credential ? credential.configPayload : null });
  } catch (error) {
    console.error('Failed to load credentials:', error);
    res.status(500).json({ error: 'Failed to load credentials' });
  }
});

/* ------------ wizard steps: data sync + schedule (JSON payload per customer/integration) ------------ */
function configPayloadRoutes(path, model, label) {
  app.get(`${path}/:integrationId`, requireSession, requireIntegration, async (req, res) => {
    try {
      const row = await model.findUnique({
        where: { customerId_integrationId: { customerId: req.customer.id, integrationId: req.params.integrationId } },
      });
      res.json({ configPayload: row ? row.configPayload : null });
    } catch (error) {
      console.error(`Failed to load ${label}:`, error);
      res.status(500).json({ error: `Failed to load ${label}` });
    }
  });

  app.post(`${path}/:integrationId`, requireSession, requireIntegration, async (req, res) => {
    const { integrationId } = req.params;
    const configPayload = JSON.stringify(req.body ?? {});
    try {
      await model.upsert({
        where: { customerId_integrationId: { customerId: req.customer.id, integrationId } },
        update: { configPayload, modifiedBy: null },
        create: { customerId: req.customer.id, integrationId, configPayload },
      });
      res.json({ success: true, message: `${label} saved successfully` });
    } catch (error) {
      console.error(`Failed to save ${label}:`, error);
      res.status(500).json({ error: `Failed to save ${label}` });
    }
  });
}

configPayloadRoutes('/api/data-sync', prisma.dataSyncCredential, 'Data sync settings');
configPayloadRoutes('/api/schedule', prisma.scheduleCredential, 'Schedule settings');

/* ------------ Slack wizard: test connection + test message ------------ */
async function callSlack(method, token, body) {
  const r = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`Slack API responded ${r.status}`);
  return r.json();
}

// Checks the bot token before the connection step is saved; returns the workspace name
app.post('/api/slack/:integrationId/test-connection', strictLimiter, requireSession, requireIntegration, async (req, res) => {
  const token = String(req.body?.accessToken ?? '');
  if (!token.startsWith('xoxb-')) return res.status(400).json({ error: 'invalid_token' });
  try {
    const result = await callSlack('auth.test', token);
    if (!result.ok) return res.status(400).json({ error: result.error || 'slack_connection_failed' });
    res.json({ ok: true, workspaceName: result.team });
  } catch (error) {
    console.error('Slack test connection failed:', error);
    res.status(502).json({ error: 'slack_unreachable' });
  }
});

// Posts a test message to a channel using the saved bot token
app.post('/api/slack/:integrationId/test-message', strictLimiter, requireSession, requireIntegration, async (req, res) => {
  const channel = String(req.body?.channel ?? '').trim().replace(/^#/, '');
  if (!channel) return res.status(400).json({ error: 'channel_required' });
  try {
    const credential = await prisma.connectionCredential.findFirst({
      where: { customerId: req.customer.id, integrationId: req.params.integrationId },
    });
    const token = credential ? JSON.parse(credential.configPayload)?.accessToken : null;
    if (!token) return res.status(400).json({ error: 'not_connected' });

    const result = await callSlack('chat.postMessage', token, {
      channel,
      text: 'This is a test message from Trustwell. Notifications will be posted to this channel.',
    });
    if (!result.ok) return res.status(400).json({ error: result.error || 'slack_post_failed' });
    res.json({ ok: true });
  } catch (error) {
    console.error('Slack test message failed:', error);
    res.status(502).json({ error: 'slack_unreachable' });
  }
});

/* ------------ admin console API (/admin UI): see src/admin ------------ */
// Signed-in admin session (cookie `admin_sid` or Bearer), or the x-admin-key shared secret for scripts
app.use(
  '/api/admin',
  createAdminRouter({
    prisma,
    secret: JWT_SECRET,
    adminApiKey: ADMIN_API_KEY,
    safeEqual,
    cookieOptions,
    strictLimiter,
    validateGenesisToken,
  })
);

/* ------------ start ------------ */
app.listen(Number(PORT), () => {
  console.log(`API listening on :${PORT}`);
  console.log('Allowed origins:', [...ALLOW_ORIGINS].join(', ') || '(none)');
  console.log('Frame ancestors:', FRAME_ANCESTOR_LIST.join(', ') || '(self only)');
  console.log('Demo login:', DEMO_LOGIN_CODE ? `?code=${DEMO_LOGIN_CODE}` : '(disabled)');
});