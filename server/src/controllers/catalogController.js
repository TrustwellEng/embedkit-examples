import express from 'express';

// Admin CRUD for the global IntegrationsCatalog table.
// Mount behind admin auth: app.use('/api/admin/catalog', requireAdmin, createCatalogRouter(prisma))

const CATALOG_ID_RE = /^[A-Za-z0-9_-]{1,50}$/;
// field -> { max length, required on create, nullable }
const CATALOG_FIELDS = {
  name: { max: 100, required: true },
  category: { max: 50, required: true },
  iconUrl: { max: 500, nullable: true },
  badge: { max: 50, nullable: true },
};

// Returns { data } or { error }. `partial` = PATCH semantics (only validate provided fields).
function parseCatalogBody(body, { partial }) {
  if (!body || typeof body !== 'object') return { error: 'Body must be a JSON object' };
  const data = {};

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

  if (body.isGlobalActive !== undefined) {
    if (typeof body.isGlobalActive !== 'boolean') return { error: 'isGlobalActive must be a boolean' };
    data.isGlobalActive = body.isGlobalActive;
  }
  return { data };
}

export function createCatalogRouter(prisma) {
  const router = express.Router();

  router.get('/', async (_req, res) => {
    try {
      res.json(await prisma.integrationsCatalog.findMany({ orderBy: { name: 'asc' } }));
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

    try {
      // Create the catalog item and give it to every existing customer in one transaction
      const [item, customersAdded] = await prisma.$transaction(async (tx) => {
        const created = await tx.integrationsCatalog.create({ data: { id, ...data } });
        const added = await tx.$executeRaw`
          INSERT INTO CustomerIntegration (customerId, integrationId, isEnabled, isConfigured)
          SELECT c.id, ${id}, ${enableForCustomers}, 0
          FROM Customer c`;
        return [created, added];
      });
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
      const item = await prisma.integrationsCatalog.update({ where: { id: req.params.id }, data });
      res.json(item);
    } catch (err) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'not_found' });
      console.error('Failed to update catalog item:', err);
      res.status(500).json({ error: 'Failed to update catalog item' });
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
      await prisma.integrationsCatalog.delete({ where: { id } });
      res.status(204).end();
    } catch (err) {
      if (err?.code === 'P2025') return res.status(404).json({ error: 'not_found' });
      console.error('Failed to delete catalog item:', err);
      res.status(500).json({ error: 'Failed to delete catalog item' });
    }
  });

  return router;
}
