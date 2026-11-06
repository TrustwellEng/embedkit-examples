import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { hashPassword, verifyPassword } from '../src/admin/auth.js';
import { createFlqAuth, validateFlqCredentials } from '../src/flq/auth.js';

// POST /api/flq/code wired like server.js (auth middleware + code handler), with an in-memory Customer table
// and a stubbed FoodLogiQ credential check. server.js itself needs a live DB, so the code handler here mirrors sendCode.

const USERNAME = 'ops@acme.example';
const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'rotated on the FoodLogiQ side';

let customers;
let integrationCalls;
let flqAccepts; // what the stubbed FoodLogiQ API answers: true, false, or 'down'
let logged;
const originalConsole = { log: console.log, warn: console.warn, error: console.error };

const prisma = {
  customer: {
    findUnique: async ({ where }) => customers.find((c) => c.flqCustomerId === where.flqCustomerId) ?? null,
    create: async ({ data }) => {
      const customer = { id: `id-${customers.length + 1}`, genesisId: null, genesisAuthToken: null, ...data };
      customers.push(customer);
      return customer;
    },
    update: async ({ where, data }) => Object.assign(customers.find((c) => c.id === where.id), data),
  },
};

function makeApp() {
  const validateCredentials = async (_url, username, password) => {
    if (flqAccepts === 'down') throw new Error('FoodLogiQ API responded 503');
    return flqAccepts && username.toLowerCase() === USERNAME && (password === PASSWORD || password === NEW_PASSWORD);
  };
  const addMissingIntegrations = async (customerId) => integrationCalls.push(customerId);

  const app = express();
  app.post('/api/flq/code', createFlqAuth({ prisma, addMissingIntegrations, authUrl: 'unused', validateCredentials }), (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ code: `code-for-${req.customer.id}`, ttlSec: 60 });
  });
  return app;
}

const post = (headers) => {
  const req = request(makeApp()).post('/api/flq/code');
  for (const [name, value] of Object.entries(headers)) req.set(name, value);
  return req;
};

const validHeaders = () => ({ 'x-customer-id': '12345', 'x-username': USERNAME, 'x-password': PASSWORD });

let existing;
before(async () => {
  existing = { id: 'id-existing', genesisId: null, flqCustomerId: '12345', flqUsername: USERNAME, flqPasswordHash: await hashPassword(PASSWORD) };
});

beforeEach(() => {
  customers = [{ ...existing }];
  integrationCalls = [];
  flqAccepts = true;
  logged = [];
  for (const level of Object.keys(originalConsole)) console[level] = (...args) => logged.push(args.join(' '));
});

afterEach(() => Object.assign(console, originalConsole));

describe('POST /api/flq/code', () => {
  it('issues a code for an existing customer', async () => {
    const res = await post(validHeaders());

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { code: 'code-for-id-existing', ttlSec: 60 });
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.deepEqual(integrationCalls, ['id-existing']);
  });

  it('creates the customer on first call once FoodLogiQ accepts the credentials', async () => {
    const res = await post({ ...validHeaders(), 'x-customer-id': '67890' });

    assert.equal(res.status, 200);
    const created = customers.find((c) => c.flqCustomerId === '67890');
    assert.ok(created);
    assert.equal(created.genesisId, null);
    assert.equal(created.flqUsername, USERNAME);
    assert.ok(await verifyPassword(PASSWORD, created.flqPasswordHash));
    assert.deepEqual(res.body, { code: `code-for-${created.id}`, ttlSec: 60 });
    assert.deepEqual(integrationCalls, [created.id]);
  });

  it('does not create the customer when FoodLogiQ rejects the credentials', async () => {
    flqAccepts = false;
    const res = await post({ ...validHeaders(), 'x-customer-id': '67890' });

    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Invalid Credentials' });
    assert.equal(customers.length, 1);
  });

  it('updates the stored hash when the password changed on the FoodLogiQ side', async () => {
    const res = await post({ ...validHeaders(), 'x-password': NEW_PASSWORD });

    assert.equal(res.status, 200);
    assert.ok(await verifyPassword(NEW_PASSWORD, customers[0].flqPasswordHash));
  });

  it('matches the username case-insensitively', async () => {
    const res = await post({ ...validHeaders(), 'x-username': USERNAME.toUpperCase() });
    assert.equal(res.status, 200);
  });

  for (const missing of ['x-customer-id', 'x-username', 'x-password']) {
    it(`returns 400 when ${missing} is missing`, async () => {
      const headers = validHeaders();
      delete headers[missing];
      const res = await post(headers);

      assert.equal(res.status, 400);
      assert.deepEqual(res.body, { error: 'Missing Credentials' });
    });
  }

  it('returns 400 when a header is blank', async () => {
    const res = await post({ ...validHeaders(), 'x-username': '   ' });
    assert.equal(res.status, 400);
  });

  it('returns 401 for a wrong password', async () => {
    const res = await post({ ...validHeaders(), 'x-password': 'wrong password' });

    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Invalid Credentials' });
    assert.deepEqual(integrationCalls, []);
  });

  it("returns 401 when another FoodLogiQ user signs in with an existing customer's id", async () => {
    customers[0].flqUsername = 'someone-else@acme.example';
    const res = await post(validHeaders());

    assert.equal(res.status, 401);
    assert.deepEqual(integrationCalls, []);
  });

  it('returns 502 when FoodLogiQ is unreachable', async () => {
    flqAccepts = 'down';
    const res = await post(validHeaders());

    assert.equal(res.status, 502);
    assert.deepEqual(res.body, { error: 'flq_unreachable' });
  });

  it('never returns or logs the password', async () => {
    const rejected = await post({ ...validHeaders(), 'x-password': 'wrong password' });
    customers[0].flqPasswordHash = 'scrypt$bad$8$1$c2FsdA$aGFzaA'; // broken hash: scrypt throws -> 500 + console.error
    const failed = await post(validHeaders());
    flqAccepts = 'down';
    const unreachable = await post(validHeaders());

    assert.equal(failed.status, 500);
    assert.ok(logged.length >= 2);
    for (const res of [rejected, failed, unreachable]) assert.ok(!res.text.includes(PASSWORD) && !res.text.includes('wrong password'));
    assert.ok(!logged.some((line) => line.includes(PASSWORD) || line.includes('wrong password')));
  });
});

describe('validateFlqCredentials', () => {
  // Stand-in for https://sandbox-api.foodlogiq.com/oauth_accesstoken
  let server;
  let url;
  let received;
  let reply;

  before(async () => {
    const app = express();
    app.post('/oauth_accesstoken', express.json(), (req, res) => {
      received = req.body;
      res.status(reply.status).send(reply.body);
    });
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    url = `http://127.0.0.1:${server.address().port}/oauth_accesstoken`;
  });

  after(() => server.close());

  it('sends email + password and accepts a token', async () => {
    reply = { status: 200, body: { access_token: 'abc' } };
    assert.equal(await validateFlqCredentials(url, USERNAME, PASSWORD), true);
    assert.deepEqual(received, { email: USERNAME, password: PASSWORD });
  });

  it('rejects a 401 (wrong credentials)', async () => {
    reply = { status: 401, body: 'Error getting access token' };
    assert.equal(await validateFlqCredentials(url, USERNAME, 'wrong'), false);
  });

  it('rejects a success with an empty body', async () => {
    reply = { status: 200, body: '' };
    assert.equal(await validateFlqCredentials(url, USERNAME, PASSWORD), false);
  });

  it('throws on a server error so the route answers 502', async () => {
    reply = { status: 503, body: 'down' };
    await assert.rejects(validateFlqCredentials(url, USERNAME, PASSWORD), /responded 503/);
  });
});
