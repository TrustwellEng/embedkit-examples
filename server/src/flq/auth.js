import { hashPassword, verifyPassword } from '../admin/auth.js';

// Food LogiQ sign-in for POST /api/flq/code, the FLQ counterpart of genesisAuth in server.js:
// x-customer-id + x-username + x-password are checked against the FoodLogiQ auth API, then the customer is
// created on first call (like Genesis) or matched against Customer.flqCustomerId / flqUsername.
// Only the auth layer differs from POST /api/code; the route then runs the same code-issuing handler.
// The password is never logged or returned, and the FoodLogiQ access token is not kept.

const header = (req, name) => {
  const value = req.headers[name];
  return typeof value === 'string' ? value.trim() : '';
};

// Returns true if FoodLogiQ issues an access token for these credentials, false if it rejects them.
// Throws when FoodLogiQ is unreachable or returns an unexpected error.
export async function validateFlqCredentials(authUrl, username, password) {
  const r = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: username, password }),
    signal: AbortSignal.timeout(10_000),
  });

  // Wrong credentials: 401 "Error getting access token"
  if (r.status === 400 || r.status === 401 || r.status === 403) return false;
  if (!r.ok) throw new Error(`FoodLogiQ API responded ${r.status}`);
  // Success carries the bearer token; an empty body is not a success
  return (await r.text()).trim().length > 0;
}

export function createFlqAuth({ prisma, addMissingIntegrations, authUrl, validateCredentials = validateFlqCredentials }) {
  return async function flqAuth(req, res, next) {
    const customerId = header(req, 'x-customer-id');
    const username = header(req, 'x-username');
    const password = typeof req.headers['x-password'] === 'string' ? req.headers['x-password'] : '';

    if (!customerId || !username || !password) {
      return res.status(400).json({ error: 'Missing Credentials' });
    }

    try {
      if (!(await validateCredentials(authUrl, username, password))) {
        return res.status(401).json({ error: 'Invalid Credentials' });
      }
    } catch (error) {
      console.error('FoodLogiQ credential validation failed:', error?.message || error);
      return res.status(502).json({ error: 'flq_unreachable' });
    }

    try {
      let customer = await prisma.customer.findUnique({ where: { flqCustomerId: customerId } });

      if (!customer) {
        // First request for this customer: credentials were validated by FoodLogiQ above
        try {
          customer = await prisma.customer.create({
            data: { flqCustomerId: customerId, flqUsername: username, flqPasswordHash: await hashPassword(password) },
          });
        } catch (error) {
          // Two first requests at the same time: the other one created it
          if (error?.code !== 'P2002') throw error;
          customer = await prisma.customer.findUnique({ where: { flqCustomerId: customerId } });
        }
      }

      // The customer id belongs to the FoodLogiQ user who first signed in with it (usernames are emails)
      if (customer.flqUsername?.toLowerCase() !== username.toLowerCase()) {
        return res.status(401).json({ error: 'Invalid Credentials' });
      }

      // Password changed on the FoodLogiQ side: FoodLogiQ accepted it above, so keep the stored hash current
      if (!customer.flqPasswordHash || !(await verifyPassword(password, customer.flqPasswordHash))) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { flqPasswordHash: await hashPassword(password) },
        });
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
      console.error('flqAuth error:', error?.message || error);
      res.status(500).json({ error: 'Database error' });
    }
  };
}
