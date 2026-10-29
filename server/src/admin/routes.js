import express from 'express';
import { createCatalogRouter, visibilityOf } from '../controllers/catalogController.js';
import {
  actorId,
  ADMIN_COOKIE,
  ADMIN_SESSION_TTL_SEC,
  createAudit,
  createRequireAdmin,
  hashPassword,
  isLocked,
  LOCKOUT_MINUTES,
  MAX_FAILED_LOGINS,
  MIN_PASSWORD_LENGTH,
  signAdminSession,
  temporaryPassword,
  toAdminDto,
  verifyPassword,
} from './auth.js';

const CUSTOMER_PAGE_SIZE = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normalizeEmail = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

// Same hash cost on unknown emails so response time doesn't reveal which emails exist
const DUMMY_HASH_PROMISE = hashPassword('not-a-real-password');

/**
 * Admin console API, mounted at /api/admin.
 * deps: prisma, secret (JWT), adminApiKey, safeEqual, cookieOptions(), strictLimiter, validateGenesisToken
 */
export function createAdminRouter(deps) {
  const { prisma, secret, cookieOptions, strictLimiter, validateGenesisToken } = deps;
  const router = express.Router();
  const requireAdmin = createRequireAdmin(deps);
  const audit = createAudit(prisma);

  // id -> email for the *By stamps, so the UI can show who changed what
  async function actorEmails(ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return {};
    const users = await prisma.adminUser.findMany({ where: { id: { in: unique } }, select: { id: true, email: true } });
    return Object.fromEntries(users.map((u) => [u.id, u.email]));
  }

  const handle = (label, fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      console.error(`${label} failed:`, error);
      if (!res.headersSent) res.status(500).json({ error: `${label} failed` });
    }
  };

  /* ------------ auth ------------ */
  router.post(
    '/auth/login',
    strictLimiter,
    handle('Sign-in', async (req, res) => {
      const email = normalizeEmail(req.body?.email);
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const invalid = () => res.status(401).json({ error: 'invalid_credentials' });
      if (!email || !password) return invalid();

      const user = await prisma.adminUser.findUnique({ where: { email } });
      if (!user) {
        await verifyPassword(password, await DUMMY_HASH_PROMISE);
        await audit(req, 'login_failed', { email, userId: null, detail: 'Unknown email' });
        return invalid();
      }
      if (!user.isActive) {
        await audit(req, 'login_failed', { email, userId: user.id, detail: 'Inactive account' });
        return invalid();
      }
      if (isLocked(user)) {
        await audit(req, 'login_failed', { email, userId: user.id, detail: 'Account locked' });
        return res.status(423).json({ error: 'locked', lockoutEnd: user.lockoutEnd });
      }

      if (!(await verifyPassword(password, user.passwordHash))) {
        // A lock that has run out starts a fresh count
        const failed = (user.lockoutEnd ? 0 : user.failedLoginCount) + 1;
        const lock = failed >= MAX_FAILED_LOGINS;
        await prisma.adminUser.update({
          where: { id: user.id },
          data: {
            failedLoginCount: failed,
            lockoutEnd: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
            modifiedBy: null,
          },
        });
        await audit(req, 'login_failed', {
          email,
          userId: user.id,
          detail: lock ? `Wrong password, locked for ${LOCKOUT_MINUTES} minutes` : 'Wrong password',
        });
        return invalid();
      }

      const updated = await prisma.adminUser.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockoutEnd: null, lastLoginAt: new Date(), modifiedBy: null },
      });
      req.admin = updated;
      await audit(req, 'login_success');

      const token = signAdminSession(updated, secret);
      res.cookie(ADMIN_COOKIE, token, { ...cookieOptions(), maxAge: ADMIN_SESSION_TTL_SEC * 1000 });
      res.set('Cache-Control', 'no-store');
      res.json({ token, expiresIn: ADMIN_SESSION_TTL_SEC, user: toAdminDto(updated) });
    })
  );

  router.post(
    '/auth/logout',
    requireAdmin({ allowPasswordChange: true }),
    handle('Sign-out', async (req, res) => {
      await audit(req, 'logout');
      res.clearCookie(ADMIN_COOKIE, cookieOptions());
      res.json({ ok: true });
    })
  );

  router.get('/auth/me', requireAdmin({ allowPasswordChange: true }), (req, res) => {
    if (!req.admin) return res.status(400).json({ error: 'not_a_user_session' });
    res.json(toAdminDto(req.admin));
  });

  router.post(
    '/auth/change-password',
    strictLimiter,
    requireAdmin({ allowPasswordChange: true }),
    handle('Change password', async (req, res) => {
      if (!req.admin) return res.status(400).json({ error: 'not_a_user_session' });
      const { currentPassword, newPassword } = req.body ?? {};
      if (typeof currentPassword !== 'string' || !(await verifyPassword(currentPassword, req.admin.passwordHash))) {
        return res.status(400).json({ error: 'wrong_current_password' });
      }
      if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: 'password_too_short', minLength: MIN_PASSWORD_LENGTH });
      }
      if (newPassword === currentPassword) return res.status(400).json({ error: 'password_unchanged' });

      const updated = await prisma.adminUser.update({
        where: { id: req.admin.id },
        data: {
          passwordHash: await hashPassword(newPassword),
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          modifiedBy: req.admin.id,
        },
      });
      await audit(req, 'user_updated', { detail: 'Changed own password' });
      // Other sessions are now stale; issue a fresh one for this browser
      const token = signAdminSession(updated, secret);
      res.cookie(ADMIN_COOKIE, token, { ...cookieOptions(), maxAge: ADMIN_SESSION_TTL_SEC * 1000 });
      res.json({ token, user: toAdminDto(updated) });
    })
  );

  /* ------------ everything below needs a full admin session (or x-admin-key) ------------ */
  router.use(requireAdmin());

  /* ------------ admin users ------------ */
  router.get(
    '/users',
    handle('List users', async (_req, res) => {
      const users = await prisma.adminUser.findMany({ orderBy: { email: 'asc' } });
      const emails = await actorEmails(users.flatMap((u) => [u.createdBy, u.modifiedBy]));
      res.json(users.map((u) => ({ ...toAdminDto(u), createdByEmail: emails[u.createdBy] ?? null, modifiedByEmail: emails[u.modifiedBy] ?? null })));
    })
  );

  router.post(
    '/users',
    handle('Create user', async (req, res) => {
      const email = normalizeEmail(req.body?.email);
      if (!EMAIL_RE.test(email) || email.length > 256) return res.status(400).json({ error: 'invalid_email' });
      const password = temporaryPassword();
      try {
        const user = await prisma.adminUser.create({
          data: {
            email,
            passwordHash: await hashPassword(password),
            mustChangePassword: true,
            createdBy: actorId(req),
            modifiedBy: actorId(req),
          },
        });
        await audit(req, 'user_created', { detail: email });
        // Shown once; only the hash is stored
        res.status(201).json({ user: toAdminDto(user), temporaryPassword: password });
      } catch (err) {
        if (err?.code === 'P2002') return res.status(409).json({ error: 'email_already_exists' });
        throw err;
      }
    })
  );

  async function findUser(req, res) {
    if (!GUID_RE.test(req.params.id)) {
      res.status(404).json({ error: 'not_found' });
      return null;
    }
    const user = await prisma.adminUser.findUnique({ where: { id: req.params.id } });
    if (!user) res.status(404).json({ error: 'not_found' });
    return user;
  }

  router.patch(
    '/users/:id',
    handle('Update user', async (req, res) => {
      const { isActive } = req.body ?? {};
      if (typeof isActive !== 'boolean') return res.status(400).json({ error: 'isActive must be a boolean' });
      const user = await findUser(req, res);
      if (!user) return;
      if (user.id === req.admin?.id && !isActive) return res.status(400).json({ error: 'cannot_deactivate_self' });

      const updated = await prisma.adminUser.update({ where: { id: user.id }, data: { isActive, modifiedBy: actorId(req) } });
      await audit(req, 'user_updated', { detail: `${user.email} → ${isActive ? 'active' : 'inactive'}` });
      res.json(toAdminDto(updated));
    })
  );

  router.post(
    '/users/:id/reset-password',
    handle('Reset password', async (req, res) => {
      const user = await findUser(req, res);
      if (!user) return;
      const password = temporaryPassword();
      await prisma.adminUser.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(password),
          mustChangePassword: true,
          passwordChangedAt: new Date(), // signs the user out everywhere
          failedLoginCount: 0,
          lockoutEnd: null,
          modifiedBy: actorId(req),
        },
      });
      await audit(req, 'password_reset', { detail: user.email });
      res.json({ temporaryPassword: password });
    })
  );

  router.post(
    '/users/:id/unlock',
    handle('Unlock user', async (req, res) => {
      const user = await findUser(req, res);
      if (!user) return;
      const updated = await prisma.adminUser.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockoutEnd: null, modifiedBy: actorId(req) },
      });
      await audit(req, 'user_updated', { detail: `${user.email} unlocked` });
      res.json(toAdminDto(updated));
    })
  );

  /* ------------ audit log ------------ */
  router.get(
    '/audit',
    handle('List audit log', async (req, res) => {
      const { action, q, from, to } = req.query;
      const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);
      const createdAt = {};
      if (typeof from === 'string' && from) createdAt.gte = new Date(from);
      if (typeof to === 'string' && to) createdAt.lt = new Date(new Date(to).getTime() + 86_400_000); // inclusive day
      if (Object.values(createdAt).some((d) => Number.isNaN(d.getTime()))) return res.status(400).json({ error: 'invalid_date' });

      const text = typeof q === 'string' ? q.trim() : '';
      const rows = await prisma.adminAuditLog.findMany({
        where: {
          ...(typeof action === 'string' && action ? { action } : {}),
          ...(Object.keys(createdAt).length ? { createdAt } : {}),
          ...(text ? { OR: [{ email: { contains: text } }, { detail: { contains: text } }] } : {}),
        },
        orderBy: { id: 'desc' },
        take: limit,
      });
      res.json(rows.map((r) => ({ ...r, id: Number(r.id) })));
    })
  );

  /* ------------ customers + Genesis token ------------ */
  async function integrationCounts(customerIds) {
    const [enabled, configured] = await Promise.all([
      prisma.customerIntegration.groupBy({ by: ['customerId'], where: { customerId: { in: customerIds }, isEnabled: true }, _count: { _all: true } }),
      prisma.customerIntegration.groupBy({ by: ['customerId'], where: { customerId: { in: customerIds }, isConfigured: true }, _count: { _all: true } }),
    ]);
    const map = (rows) => Object.fromEntries(rows.map((r) => [r.customerId, r._count._all]));
    return { enabled: map(enabled), configured: map(configured) };
  }

  const toCustomerDto = (c, counts, emails) => ({
    id: c.id,
    genesisId: c.genesisId,
    customerName: c.customerName,
    tokenPreview: String(c.genesisAuthToken).slice(-4), // the full token never leaves the server
    createdAt: c.createdAt,
    createdByEmail: emails[c.createdBy] ?? null,
    modifiedAt: c.modifiedAt,
    modifiedByEmail: emails[c.modifiedBy] ?? null,
    enabledCount: counts.enabled[c.id] ?? 0,
    configuredCount: counts.configured[c.id] ?? 0,
  });

  router.get(
    '/customers',
    // Paged: ?page=1&pageSize=30&q=<customer ID contains>
    handle('List customers', async (req, res) => {
      const pageSize = Math.min(Math.max(Number(req.query.pageSize) || CUSTOMER_PAGE_SIZE, 1), CUSTOMER_PAGE_SIZE);
      const page = Math.max(Math.floor(Number(req.query.page)) || 1, 1);
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const where = q ? { genesisId: { contains: q } } : {};

      const [total, customers] = await Promise.all([
        prisma.customer.count({ where }),
        prisma.customer.findMany({ where, orderBy: { genesisId: 'asc' }, skip: (page - 1) * pageSize, take: pageSize }),
      ]);
      const [counts, emails] = await Promise.all([
        integrationCounts(customers.map((c) => c.id)),
        actorEmails(customers.flatMap((c) => [c.createdBy, c.modifiedBy])),
      ]);
      res.json({ items: customers.map((c) => toCustomerDto(c, counts, emails)), total, page, pageSize });
    })
  );

  async function findCustomer(req, res) {
    if (!GUID_RE.test(req.params.id)) {
      res.status(404).json({ error: 'not_found' });
      return null;
    }
    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) res.status(404).json({ error: 'not_found' });
    return customer;
  }

  async function customerDto(customer) {
    const [counts, emails] = await Promise.all([
      integrationCounts([customer.id]),
      actorEmails([customer.createdBy, customer.modifiedBy]),
    ]);
    return toCustomerDto(customer, counts, emails);
  }

  router.get(
    '/customers/:id',
    handle('Load customer', async (req, res) => {
      const customer = await findCustomer(req, res);
      if (customer) res.json(await customerDto(customer));
    })
  );

  // New token is validated with Genesis exactly like a customer sign-in (POST /api/code); saved only if accepted
  router.put(
    '/customers/:id/token',
    strictLimiter,
    handle('Update token', async (req, res) => {
      const customer = await findCustomer(req, res);
      if (!customer) return;
      const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
      if (!token || token.length > 255) return res.status(400).json({ error: 'invalid_token' });

      let valid;
      try {
        valid = await validateGenesisToken(token);
      } catch (error) {
        console.error('Genesis token validation failed:', error?.message || error);
        return res.status(502).json({ error: 'genesis_unreachable' });
      }
      if (!valid) {
        await audit(req, 'token_rejected', { detail: `${customer.genesisId}: rejected by Genesis` });
        return res.status(403).json({ error: 'invalid_token' });
      }

      const updated = await prisma.customer.update({
        where: { id: customer.id },
        data: { genesisAuthToken: token, modifiedBy: actorId(req) },
      });
      await audit(req, 'token_updated', { detail: customer.genesisId });
      res.json(await customerDto(updated));
    })
  );

  router.get(
    '/customers/:id/integrations',
    handle('Load customer integrations', async (req, res) => {
      const customer = await findCustomer(req, res);
      if (!customer) return;
      const [catalog, rows, credentials] = await Promise.all([
        prisma.integrationsCatalog.findMany({ orderBy: { name: 'asc' }, include: { sourceInfos: { select: { source: true, isActive: true } } } }),
        prisma.customerIntegration.findMany({ where: { customerId: customer.id } }),
        prisma.connectionCredential.findMany({ where: { customerId: customer.id }, select: { integrationId: true, modifiedAt: true } }),
      ]);
      const byId = Object.fromEntries(rows.map((r) => [r.integrationId, r]));
      const credentialAt = Object.fromEntries(credentials.map((c) => [c.integrationId, c.modifiedAt]));
      const emails = await actorEmails(rows.map((r) => r.modifiedBy));

      res.json(
        catalog.map((item) => {
          const row = byId[item.id];
          return {
            integrationId: item.id,
            name: item.name,
            badge: item.badge,
            iconUrl: item.iconUrl,
            isGlobalActive: item.isGlobalActive,
            isComingSoon: item.isComingSoon,
            visibleIn: visibilityOf(item.sourceInfos),
            isEnabled: row?.isEnabled ?? false,
            isConfigured: row?.isConfigured ?? false,
            credentialUpdatedAt: credentialAt[item.id] ?? null,
            modifiedAt: row?.modifiedAt ?? null,
            modifiedByEmail: emails[row?.modifiedBy] ?? null,
          };
        })
      );
    })
  );

  router.patch(
    '/customers/:id/integrations/:integrationId',
    handle('Update customer integration', async (req, res) => {
      const { isEnabled } = req.body ?? {};
      if (typeof isEnabled !== 'boolean') return res.status(400).json({ error: 'isEnabled must be a boolean' });
      const customer = await findCustomer(req, res);
      if (!customer) return;
      const { integrationId } = req.params;
      const item = await prisma.integrationsCatalog.findUnique({ where: { id: integrationId }, select: { id: true } });
      if (!item) return res.status(404).json({ error: 'integration_not_found' });

      const by = actorId(req);
      await prisma.customerIntegration.upsert({
        where: { customerId_integrationId: { customerId: customer.id, integrationId } },
        update: { isEnabled, modifiedBy: by },
        create: { customerId: customer.id, integrationId, isEnabled, isConfigured: false, createdBy: by, modifiedBy: by },
      });
      await audit(req, 'integration_toggled', { detail: `${customer.genesisId} / ${integrationId} → ${isEnabled ? 'on' : 'off'}` });
      res.json({ ok: true });
    })
  );

  /* ------------ integrations catalog ------------ */
  router.use('/catalog', createCatalogRouter(prisma, { audit, actorId, actorEmails }));

  return router;
}
