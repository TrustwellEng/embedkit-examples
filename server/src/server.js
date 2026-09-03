import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import fetch from 'node-fetch';
import 'dotenv/config';
import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from '@prisma/client';
/* ------------ env ------------ */
const {
  PORT = 8080,
  NODE_ENV,
  JWT_SECRET,
  CORS_ORIGINS,
  COOKIE_DOMAIN,
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

let iEmail
/* ------------ app ------------ */
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'tiny'));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

/* ------------ CORS (multi-origin, credentialed) ------------ */
const ALLOW_ORIGINS = new Set(
  (CORS_ORIGINS ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

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

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOW_ORIGINS.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-genesis-customer-id, x-genesis-auth-token');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* ------------ rate limit ------------ */
const limiter = new RateLimiterMemory({ points: 100, duration: 60 });
app.use(async (req, res, next) => {
  try {
    await limiter.consume(req.ip);
    return next();
  } catch {
    return res.status(429).json({ error: 'rate_limited' });
  }
});

/* ------------ cookie helpers ------------ */
function cookieOptions(req) {
  const origin = req.headers.origin || '';
  const allow = origin && ALLOW_ORIGINS.has(origin);
  const isProd = NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: allow || isProd,          // required when SameSite=None
    sameSite: allow ? 'none' : 'lax', // cross-site vs same-site
    path: '/',
    domain: COOKIE_DOMAIN || undefined,
  };
}

/* ------------ session helpers ------------ */
function setSession(req, res, claims) {
  if (!claims || typeof claims !== 'object') {
    return res.status(500).json({ error: 'internal_no_claims' });
  }
  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'server_misconfigured' });
  }
  const token = jwt.sign(claims, JWT_SECRET, { expiresIn: '2h' });
  res.cookie('sid', token, { ...cookieOptions(req), maxAge: 2 * 60 * 60 * 1000 });
}

function requireAuth(req, res, next) {
  const c = req.cookies?.sid;
  if (!c) return res.status(401).json({ error: 'unauthorized' });
  try {
    req.user = jwt.verify(c, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

/* ------------ routes ------------ */

// Health
app.get('/api/ping', (_req, res) => res.json({ ok: true }));

// get a valid session token back
app.post('/api/session', async (req, res) => {
  console.log('[login] Login attempt');
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email_and_password_required' });
  }
  iEmail = String(email).toLowerCase();
  console.log(`[login] Authenticating user: ${email}`);

  // 1) Authenticate against DB (demo: plain compare; hash in prod)
  console.log(`[login] User logged in: ${email}`);

  // 2) Set app session cookie (host app session)
  setSession(req, res, {
    sub: String(email.toLowerCase()),
    email: email.toLowerCase(),
    isAdmin: false,
  });

  // Build the Boomi credential payload for BFF (server-to-server only)
  const boomiPayload = {
    url: API_URL,
    parentAccountId: API_ACCOUNT_ID,
    apiUserName: API_USERNAME,
    apiToken: API_TOKEN,
    childAccountId: API_AUTH_USER || undefined,
    accountGroup: API_ACCOUNT_GROUP || undefined,
  };

  // 4) Call EmbedKit Server /auth/login to get a NONCE (bind nonce to the browser's Origin)
  try {
    const origin = req.headers.origin || '';
    console.log('Request Session Origin:', origin, API_ACCOUNT_ID);
    const r = await fetch(`${EMBEDKIT_SERVER_BASE}/auth/admin/login`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Origin': origin,
        'X-Tenant-Id': API_ACCOUNT_ID || '',
      },
      body: JSON.stringify(boomiPayload),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error('EmbedKit Server login failed:', r.status, errText);
      return res.status(r.status).json({ error: 'Login Failed', detail: errText });
    }

    const { nonce, ttlSec } = await r.json();
    // 5) Return only the Nonce to the UI
    return res.json({ nonce, ttlSec, serverBase: EMBEDKIT_SERVER_BASE, tenantId: API_ACCOUNT_ID });
  } catch (e) {
    console.error('Error connecting to EmbedKit Server:', e);
    return res.status(502).json({ error: 'embedkit_server_unreachable' });
  }
});


// does the user have a session
app.get('/api/session', requireAuth, async (req, res) => {

  const summary = {
    id: String(iEmail),
    email: iEmail,
    isAdmin: false,
  };

  return res.json({ ok: true, user: summary });
});

// Logout (host app)
app.delete('/api/session', (req, res) => {
  res.clearCookie('sid', cookieOptions(req));
  res.json({ ok: true });
});

/* for existing auth users */
app.post('/api/session/nonce', requireAuth, async (req, res) => {
  const boomiPayload = {
    url: API_URL,
    parentAccountId: API_ACCOUNT_ID,
    apiUserName: API_USERNAME,
    apiToken: API_TOKEN,
    childAccountId: API_AUTH_USER || undefined,
    accountGroup: API_ACCOUNT_GROUP || undefined,
  };

  try {
    const origin = req.headers.origin || '';
    console.log('Request Nonce Origin:', origin);
    const r = await fetch(`${EMBEDKIT_SERVER_BASE}/auth/admin/login`, {
      method: 'POST',
      credentials: 'include', 
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': API_ACCOUNT_ID || '',
      },
      body: JSON.stringify(boomiPayload),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      return res.status(r.status).json({ error: 'embedkit_server_login_failed', detail: errText });
    }
    const { nonce, ttlSec } = await r.json();
    return res.json({ serverBase: EMBEDKIT_SERVER_BASE, nonce, ttlSec, tenantId: API_ACCOUNT_ID  });
  } catch {
    return res.status(502).json({ error: 'embedkit_server_unreachable' });
  }
});

/* For generics */
const genesisAuth = async (req, res, next) => {
  const customerId = req.headers['x-genesis-customer-id'] || req.query.genesisId;
  const authToken = req.headers['x-genesis-auth-token'] || req.query.token;
    
  if (!customerId || !authToken) {
    return res.status(401).json({ error: 'Missing Genesis Credentials' });
  }

  try {
    const customer = await prisma.customer.findUnique({
      where: { genesisId: customerId }
    });

    if(!customer){
      //Create a new customer if it doesn't exist
      const newCustomer = await prisma.customer.create({
        data: {
          genesisId: customerId,
          genesisAuthToken: authToken,
        },
      });

      await prisma.customerIntegration.createMany({
        data: [
          { customerId: newCustomer.id, integrationId: 'algolia', isEnabled: false, isConfigured: false },
          { customerId: newCustomer.id, integrationId: 'amazon-s3', isEnabled: false, isConfigured: false },
          { customerId: newCustomer.id, integrationId: 'bigquery', isEnabled: false, isConfigured: false },
          { customerId: newCustomer.id, integrationId: 'calendly', isEnabled: false, isConfigured: false },
          { customerId: newCustomer.id, integrationId: 'confluence', isEnabled: false, isConfigured: false },
          { customerId: newCustomer.id, integrationId: 'netsuite', isEnabled: true, isConfigured: false },
          { customerId: newCustomer.id, integrationId: 'oracle', isEnabled: true, isConfigured: false },
          { customerId: newCustomer.id, integrationId: 'sap_s4hana', isEnabled: true, isConfigured: false },
          { customerId: newCustomer.id, integrationId: 'slack_integration', isEnabled: true, isConfigured: false }
        ]
      });
      req.customer = newCustomer;
      return next();
    }

    if (customer.genesisAuthToken !== authToken) {
      return res.status(403).json({ error: 'Invalid Genesis Authentication' });
    }

    req.customer = customer;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
};

app.get('/api/integrations', genesisAuth, async (req, res) => {
  try {
    // Only get the apps enabled for this customer
      const availableApps = await prisma.customerIntegration.findMany({
      where: { 
        customerId: req.customer.id,
        isEnabled: true 
      },
      include: {
        integration: true // Always include name, icon, category from Catalog table
      }
    });

    // Format the data returned for Frontend Landing.tsx
    const formattedData = availableApps.map(item => ({
      id: item.integration.id,
      name: item.integration.name,
      category: item.integration.category,
      iconUrl: item.integration.iconUrl,
      badge: item.integration.badge,
      isConfigured: item.isConfigured
    }));

    res.json(formattedData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load integrations' });
  }
});

app.post('/api/credentials/:integrationId', genesisAuth, async (req, res) => {
  const { integrationId } = req.params;
  const payload = req.body; 
  try {
    const stringifiedPayload = JSON.stringify(payload);

    let credential = await prisma.connectionCredential.findFirst({
      where: { customerId: req.customer.id, integrationId: integrationId }
    });

    if (credential) {
      await prisma.connectionCredential.update({
        where: { id: credential.id },
        data: { configPayload: stringifiedPayload }
      });
    } else {
      await prisma.connectionCredential.create({
        data: {
          customerId: req.customer.id,
          integrationId: integrationId,
          configPayload: stringifiedPayload
        }
      });
    }
    await prisma.customerIntegration.update({
      where: {
        customerId_integrationId: {
          customerId: req.customer.id,
          integrationId: integrationId
        }
      },
      data: { isConfigured: true }
    });

    res.json({ success: true, message: 'Credentials saved successfully' });
  } catch (error) {
    console.error("Failed to save credentials:", error);
    res.status(500).json({ error: 'Failed to save credentials' });
  }
});

app.get('/api/credentials/:integrationId', genesisAuth, async (req, res) => {
  const { integrationId } = req.params;
  try {
    const credential = await prisma.connectionCredential.findFirst({
      where: {
        customerId: req.customer.id,
        integrationId: integrationId
      }
    });

    if (!credential) {
      return res.json({ configPayload: null });
    }

    res.json({ configPayload: credential.configPayload });
  } catch (error) {
    console.error("Failed to load credentials:", error);
    res.status(500).json({ error: 'Failed to load credentials' });
  }
});

/* ------------ start ------------ */
app.listen(Number(PORT), () => {
  console.log(`API listening on :${PORT}`);
  console.log('Allowed origins:', [...ALLOW_ORIGINS].join(', ') || '(none)');
});