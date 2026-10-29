import express from 'express';

// Admin CRUD for the global IntegrationsCatalog table.
// Mounted by the admin router (src/admin/routes.js) at /api/admin/catalog, behind admin auth.
// Writes are stamped with the signed-in admin (createdBy/modifiedBy) and written to the audit log.

const CATALOG_ID_RE = /^[A-Za-z0-9_-]{1,50}$/;
// Customer products. Visibility per product lives in IntegrationSourceInfo.isActive (no row = shown).
const PRODUCTS = ['GF', 'FLQ'];

// { GF: true, FLQ: false } from an item's IntegrationSourceInfo rows
const visibilityOf = (sourceInfos = []) =>
  Object.fromEntries(PRODUCTS.map((p) => [p, sourceInfos.find((s) => s.source === p)?.isActive ?? true]));
// field -> { max length, required on create, nullable }
const CATALOG_FIELDS = {
  name: { max: 100, required: true },
  // Optional: the admin console no longer sets it. The column is NOT NULL, so create defaults it to ''
  category: { max: 50 },
  iconUrl: { max: 500, nullable: true },
  badge: { max: 50, nullable: true },
};

// Returns { data } or { error }. `partial` = PATCH semantics (only validate provided fields).
function parseCatalogBody(body, { partial }) {
  if (!body || typeof body !== 'object') return { error: 'Body must be a JSON object' };
  const data = {};

  if (!partial && body.category === undefined) data.category = '';

  for (const [field, rule] of Object.entries(CATALOG_FIELDS)) {
    const value = body[field];
    if (value === undefined) {
      if (rule.required && !partial) return { error: `${field} is required` };
      continue;
    }
    if (value === null && rule.nullable) {
      data[field] = null;
      continue;
    }
    if (typeof value !== 'string' || !value.trim()) return { error: `${field} must be a non-empty string` };
    if (value.trim().length > rule.max) return { error: `${field} must be at most ${rule.max} characters` };
    data[field] = value.trim();
  }

  for (const flag of ['isGlobalActive', 'isComingSoon']) {
    if (body[flag] === undefined) continue;
    if (typeof body[flag] !== 'boolean') return { error: `${flag} must be a boolean` };
    data[flag] = body[flag];
  }
  return { data };
}

export { PRODUCTS, visibilityOf };

export function createCatalogRouter(prisma, { audit, actorId, actorEmails }) {
  const router = express.Router();

  router.get('/', async (_req, res) => {
    try {
      const items = await prisma.integrationsCatalog.findMany({
        orderBy: { name: 'asc' },
        include: { sourceInfos: { select: { source: true, isActive: true } } },
      });
      const emails = await actorEmails(items.flatMap((i) => [i.createdBy, i.modifiedBy]));
      res.json(
        items.map(({ sourceInfos, ...i }) => ({
          ...i,
          visibleIn: visibilityOf(sourceInfos),
          createdByEmail: emails[i.createdBy] ?? null,
          modifiedByEmail: emails[i.modifiedBy] ?? null,
        }))
      );
    } catch (error) {
      console.error('Failed to list catalog:', error);
      res.status(500).json({ error: 'Failed to list catalog' });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const item = await prisma.integrationsCatalog.findUnique({ where: { id: req.params.id } });
      if (!item) return res.status(404).json({ error: 'not_found' });
      res.json(item);
    } catch (error) {
      console.error('Failed to load catalog item:', error);
      res.status(500).json({ error: 'Failed to load catalog item' });
    }
  });

  router.post('/', async (req, res) => {
    const id = req.body?.id;
    if (typeof id !== 'string' || !CATALOG_ID_RE.test(id)) {
      return res.status(400).json({ error: 'id is required (letters, digits, "_" or "-", max 50)' });
    }
    const { data, error } = parseCatalogBody(req.body, { partial: false });
    if (error) return res.status(400).json({ error });

    const { enableForCustomers = true } = req.body;
    if (typeof enableForCustomers !== 'boolean') {
      return res.status(400).json({ error: 'enableForCustomers must be a boolean' });
    }

    const by = actorId(req);
    try {
      // Create the catalog item and give it to every existing customer in one transaction
      const [item, customersAdded] = await prisma.$transaction(async (tx) => {
        const created = await tx.integrationsCatalog.create({ data: { id, ...data, createdBy: by, modifiedBy: by } });
        const added = await tx.$executeRaw`
          INSERT INTO CustomerIntegration (customerId, integrationId, isEnabled, isConfigured, createdBy, modifiedBy)
          SELECT c.id, ${id}, ${enableForCustomers}, 0, ${by}, ${by}
          FROM Customer c`;
        return [created, added];
      });
      await audit(req, 'catalog_created', { detail: `${id} (${customersAdded} customers, ${enableForCustomers ? 'enabled' : 'disabled'})` });
      res.status(201).json({ ...item, customersAdded });
    } catch (err) {
      if (err?.code === 'P2002') return res.status(409).json({ error: 'id_already_exists' });
      console.error('Failed to create catalog item:', err);
      res.status(500).json({ error: 'Failed to create catalog item' });
    }
  });

  router.patch('/:id', async (req, res) => {
    const { data, error } = parseCatalogBody(req.body, { partial: true });
    if (error) return res.status(400).json({ error });
    if (!Object.keys(data).length) return res.status(400).json({ error: 'No fields to update' });

    try {
      const item = await prisma.integrationsCatalog.update({ where: { id: req.params.id }, data: { ...data, modifiedBy: actorId(req) } });
      const changes = Object.entries(data).map(([k, v]) => `${k}=${v}`).join(', ');
      await audit(req, 'catalog_updated', { detail: `${req.params.id}: ${changes}` });
      res.json(item);
    } catch (err) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'not_found' });
      console.error('Failed to update catalog item:', err);
      res.status(500).json({ error: 'Failed to update catalog item' });
    }
  });

  // Show/hide for one customer product (GF = Genesis, FLQ = FoodLogiQ). Uses the existing
  // IntegrationSourceInfo row (display overrides are kept) or creates one with only isActive set.
  router.put('/:id/visibility/:product', async (req, res) => {
    const { id } = req.params;
    const product = String(req.params.product).toUpperCase();
    const { visible } = req.body ?? {};
    if (!PRODUCTS.includes(product)) return res.status(400).json({ error: 'invalid_product' });
    if (typeof visible !== 'boolean') return res.status(400).json({ error: 'visible must be a boolean' });

    try {
      const item = await prisma.integrationsCatalog.findUnique({ where: { id }, select: { id: true } });
      if (!item) return res.status(404).json({ error: 'not_found' });
      const by = actorId(req);
      await prisma.integrationSourceInfo.upsert({
        where: { integrationId_source: { integrationId: id, source: product } },
        update: { isActive: visible, modifiedBy: by },
        create: { integrationId: id, source: product, isActive: visible, createdBy: by, modifiedBy: by },
      });
      await audit(req, 'catalog_updated', { detail: `${id}: ${product} ${visible ? 'shown' : 'hidden'}` });
      res.json({ ok: true });
    } catch (err) {
      console.error('Failed to update catalog visibility:', err);
      res.status(500).json({ error: 'Failed to update catalog visibility' });
    }
  });

  // Hard delete only when no customer uses it; otherwise set isGlobalActive=false instead.
  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const [customers, connections, dataSyncs, schedules] = await Promise.all([
        prisma.customerIntegration.count({ where: { integrationId: id } }),
        prisma.connectionCredential.count({ where: { integrationId: id } }),
        prisma.dataSyncCredential.count({ where: { integrationId: id } }),
        prisma.scheduleCredential.count({ where: { integrationId: id } }),
      ]);
      const credentials = connections + dataSyncs + schedules;
      if (customers || credentials) {
        return res.status(409).json({
          error: 'in_use',
          detail: `Referenced by ${customers} customer integration(s) and ${credentials} credential(s). Set isGlobalActive=false to hide it instead.`,
        });
      }
      // Per-product visibility rows belong to the item, so they go with it
      await prisma.$transaction([
        prisma.integrationSourceInfo.deleteMany({ where: { integrationId: id } }),
        prisma.integrationsCatalog.delete({ where: { id } }),
      ]);
      await audit(req, 'catalog_deleted', { detail: id });
      res.status(204).end();
    } catch (err) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'not_found' });
      console.error('Failed to delete catalog item:', err);
      res.status(500).json({ error: 'Failed to delete catalog item' });
    }
  });

  return router;
}
