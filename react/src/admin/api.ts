// Admin data layer. MOCK for now: in-memory data with async functions shaped like the planned API.
// To go live, replace each function body with apiFetch("/api/admin/...") and keep the signatures.
//
// Planned endpoints (all behind requireAuth, session cookie):
//   POST   /auth/login  { email, password }        -> { mfaRequired } | { ok }
//   POST   /auth/mfa    { code }                    -> { ok }
//   POST   /auth/logout
//   POST   /auth/change-password { current, next }
//   GET    /api/admin/users            POST /api/admin/users        PATCH /api/admin/users/:id
//   POST   /api/admin/users/:id/reset-password   POST /api/admin/users/:id/unlock
//   GET    /api/admin/audit?action=&email=&from=&to=
//   GET    /api/admin/customers
//   PUT    /api/admin/customers/:id/token { token }  -> validated with validateGenesisToken (same as user login):
//          403 invalid_token, 502 genesis_unreachable; only saved when Genesis accepts it
//   GET    /api/admin/customers/:id/integrations
//   PATCH  /api/admin/customers/:id/integrations/:integrationId { isEnabled }
//   /api/admin/catalog  (already exists on the server: GET, POST, PATCH /:id, DELETE /:id)

/* ------------ types (mirror the DB tables) ------------ */
export interface AdminUser {
  id: string;
  email: string;
  isActive: boolean;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  failedLoginCount: number;
  lockoutEnd: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export type AuditAction =
  | "login_success"
  | "login_failed"
  | "logout"
  | "user_created"
  | "user_updated"
  | "password_reset"
  | "token_updated"
  | "integration_toggled"
  | "catalog_created"
  | "catalog_updated";

export interface AuditLog {
  id: number;
  userId: string | null;
  email: string | null;
  action: AuditAction;
  detail: string | null;
  ip: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  genesisId: string;
  customerName: string | null;
  tokenPreview: string; // last 4 chars only; the full token never leaves the server
  tokenUpdatedAt: string;
  createdAt: string;
  enabledCount: number;
  configuredCount: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  iconUrl: string | null;
  badge: string | null;
  isGlobalActive: boolean;
  isComingSoon: boolean;
}

export interface CustomerIntegrationRow {
  integrationId: string;
  name: string;
  badge: string | null;
  iconUrl: string | null;
  isEnabled: boolean;
  isConfigured: boolean;
  credentialUpdatedAt: string | null;
}

// Two-factor sign-in (TOTP). Off for now: hides the MFA step and every MFA control in the console.
export const MFA_ENABLED = false;

/* ------------ mock store ------------ */
const MOCK_LATENCY = 250;
const MOCK_PASSWORD = "Admin@123";
const MOCK_MFA_CODE = "123456";

const delay = <T,>(value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), MOCK_LATENCY));
const fail = (message: string) =>
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), MOCK_LATENCY));

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const uid = () => crypto.randomUUID();
const tempPassword = () => Math.random().toString(36).slice(2, 8) + "A!" + Math.floor(Math.random() * 90 + 10);

const users: AdminUser[] = [
  { id: uid(), email: "admin@trustwell.com", isActive: true, mfaEnabled: true, mustChangePassword: false, failedLoginCount: 0, lockoutEnd: null, lastLoginAt: daysFromNow(-1), createdAt: daysFromNow(-120) },
  { id: uid(), email: "ops@trustwell.com", isActive: true, mfaEnabled: false, mustChangePassword: true, failedLoginCount: 0, lockoutEnd: null, lastLoginAt: null, createdAt: daysFromNow(-3) },
  { id: uid(), email: "support@trustwell.com", isActive: true, mfaEnabled: true, mustChangePassword: false, failedLoginCount: 5, lockoutEnd: daysFromNow(0.01), lastLoginAt: daysFromNow(-10), createdAt: daysFromNow(-60) },
  { id: uid(), email: "former@trustwell.com", isActive: false, mfaEnabled: false, mustChangePassword: false, failedLoginCount: 0, lockoutEnd: null, lastLoginAt: daysFromNow(-90), createdAt: daysFromNow(-300) },
];

const catalog: CatalogItem[] = [
  { id: "slack", name: "Slack", category: "Communication", iconUrl: "https://cdn.simpleicons.org/slack", badge: "Standard", isGlobalActive: true, isComingSoon: false },
  { id: "teams", name: "Microsoft Teams", category: "Communication", iconUrl: null, badge: "Standard", isGlobalActive: true, isComingSoon: true },
  { id: "netsuite", name: "NetSuite", category: "ERP", iconUrl: null, badge: "Standard", isGlobalActive: true, isComingSoon: false },
  { id: "oracle_plm", name: "Oracle PLM Cloud", category: "PLM", iconUrl: null, badge: "Premium", isGlobalActive: true, isComingSoon: false },
  { id: "sap", name: "SAP S/4HANA", category: "ERP", iconUrl: null, badge: "Premium", isGlobalActive: false, isComingSoon: false },
];

const customers: Customer[] = [
  { id: uid(), genesisId: "GF-10023", customerName: "Acme Foods", tokenPreview: "9f2a", tokenUpdatedAt: daysFromNow(-20), createdAt: daysFromNow(-200), enabledCount: 0, configuredCount: 0 },
  { id: uid(), genesisId: "GF-10057", customerName: "Green Valley Bakery", tokenPreview: "b71c", tokenUpdatedAt: daysFromNow(-87), createdAt: daysFromNow(-150), enabledCount: 0, configuredCount: 0 },
  { id: uid(), genesisId: "FLQ-2001", customerName: "Nordic Dairy", tokenPreview: "04de", tokenUpdatedAt: daysFromNow(-92), createdAt: daysFromNow(-400), enabledCount: 0, configuredCount: 0 },
  { id: uid(), genesisId: "GF-10101", customerName: null, tokenPreview: "77aa", tokenUpdatedAt: daysFromNow(-5), createdAt: daysFromNow(-5), enabledCount: 0, configuredCount: 0 },
];

// customerId -> integrationId -> row state
const customerIntegrations = new Map<string, Map<string, { isEnabled: boolean; isConfigured: boolean; credentialUpdatedAt: string | null }>>();
customers.forEach((c, ci) => {
  const rows = new Map();
  catalog.forEach((item, ii) => {
    const isEnabled = item.badge === "Standard" || (ci + ii) % 2 === 0;
    const isConfigured = isEnabled && (ci + ii) % 3 === 0;
    rows.set(item.id, { isEnabled, isConfigured, credentialUpdatedAt: isConfigured ? daysFromNow(-ii - 1) : null });
  });
  customerIntegrations.set(c.id, rows);
});

let auditSeq = 0;
const audit: AuditLog[] = [];
const log = (action: AuditAction, email: string | null, detail: string | null = null, ip = "10.0.0.12", at = new Date().toISOString()) => {
  const user = users.find((u) => u.email === email);
  audit.unshift({ id: ++auditSeq, userId: user?.id ?? null, email, action, detail, ip, createdAt: at });
};
// Seed history (oldest first so newest ends up on top)
[
  ["login_success", "admin@trustwell.com", null, -6],
  ["catalog_created", "admin@trustwell.com", "oracle_plm", -5.9],
  ["login_failed", "support@trustwell.com", "Wrong password", -2],
  ["login_failed", "support@trustwell.com", "Wrong password", -1.99],
  ["login_failed", "support@trustwell.com", "Locked for 15 minutes", -1.98],
  ["user_created", "admin@trustwell.com", "ops@trustwell.com", -3],
  ["token_updated", "admin@trustwell.com", "GF-10023", -1.5],
  ["integration_toggled", "admin@trustwell.com", "GF-10057 / sap → off", -1.2],
  ["login_failed", null, "Unknown email: test@test.com", -1.1],
  ["logout", "admin@trustwell.com", null, -1],
].forEach(([a, e, d, days], i) =>
  log(a as AuditAction, e as string | null, d as string | null, i % 3 ? "10.0.0.12" : "192.168.1.40", daysFromNow(days as number))
);

let currentUser: AdminUser | null = null;
let pendingMfaUser: AdminUser | null = null;
const me = () => currentUser?.email ?? null;

/* ------------ auth ------------ */
export const auth = {
  me: () => delay(currentUser),

  login(email: string, password: string): Promise<{ mfaRequired: boolean; mustChangePassword: boolean }> {
    const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    const locked = user?.lockoutEnd && new Date(user.lockoutEnd) > new Date();
    if (!user || !user.isActive || locked || password !== MOCK_PASSWORD) {
      if (user) user.failedLoginCount++;
      log("login_failed", user?.email ?? null, user ? (locked ? "Account locked" : "Wrong password") : `Unknown email: ${email}`);
      // Same message for every case so the form does not reveal which emails exist
      return fail("Invalid email or password.");
    }
    if (MFA_ENABLED && user.mfaEnabled) {
      pendingMfaUser = user;
      return delay({ mfaRequired: true, mustChangePassword: user.mustChangePassword });
    }
    return this.finishLogin(user);
  },

  verifyMfa(code: string) {
    if (!pendingMfaUser) return fail("Session expired. Sign in again.");
    if (code.trim() !== MOCK_MFA_CODE) {
      log("login_failed", pendingMfaUser.email, "Wrong MFA code");
      return fail("Invalid verification code.");
    }
    const user = pendingMfaUser;
    pendingMfaUser = null;
    return this.finishLogin(user);
  },

  finishLogin(user: AdminUser) {
    user.failedLoginCount = 0;
    user.lockoutEnd = null;
    user.lastLoginAt = new Date().toISOString();
    currentUser = user;
    log("login_success", user.email);
    return delay({ mfaRequired: false, mustChangePassword: user.mustChangePassword });
  },

  logout() {
    log("logout", me());
    currentUser = null;
    return delay(true);
  },

  changePassword(current: string, next: string) {
    if (!currentUser) return fail("Not signed in.");
    if (current !== MOCK_PASSWORD) return fail("Current password is incorrect.");
    if (next.length < 12) return fail("New password must be at least 12 characters.");
    currentUser.mustChangePassword = false;
    log("user_updated", currentUser.email, "Changed own password");
    return delay(true);
  },
};

/* ------------ users ------------ */
export const usersApi = {
  list: () => delay(users),

  create(email: string, enableMfa: boolean) {
    const normalized = email.trim().toLowerCase();
    if (users.some((u) => u.email === normalized)) return fail("A user with this email already exists.");
    const user: AdminUser = {
      id: uid(),
      email: normalized,
      isActive: true,
      mfaEnabled: enableMfa,
      mustChangePassword: true,
      failedLoginCount: 0,
      lockoutEnd: null,
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    log("user_created", me(), normalized);
    // The temporary password is shown once; the server only stores the Argon2id hash
    return delay({ user, temporaryPassword: tempPassword() });
  },

  setActive(id: string, isActive: boolean) {
    const user = users.find((u) => u.id === id);
    if (!user) return fail("User not found.");
    if (user.id === currentUser?.id && !isActive) return fail("You cannot deactivate your own account.");
    user.isActive = isActive;
    log("user_updated", me(), `${user.email} → ${isActive ? "active" : "inactive"}`);
    return delay(user);
  },

  resetPassword(id: string) {
    const user = users.find((u) => u.id === id);
    if (!user) return fail("User not found.");
    user.mustChangePassword = true;
    log("password_reset", me(), user.email);
    return delay({ temporaryPassword: tempPassword() });
  },

  unlock(id: string) {
    const user = users.find((u) => u.id === id);
    if (!user) return fail("User not found.");
    user.failedLoginCount = 0;
    user.lockoutEnd = null;
    log("user_updated", me(), `${user.email} unlocked`);
    return delay(user);
  },

  resetMfa(id: string) {
    const user = users.find((u) => u.id === id);
    if (!user) return fail("User not found.");
    user.mfaEnabled = false;
    log("user_updated", me(), `${user.email} MFA reset`);
    return delay(user);
  },
};

/* ------------ audit ------------ */
export interface AuditFilter {
  action?: AuditAction | "";
  email?: string;
  from?: string;
  to?: string;
}

export const auditApi = {
  list(filter: AuditFilter = {}) {
    const email = filter.email?.trim().toLowerCase();
    const from = filter.from ? new Date(filter.from).getTime() : -Infinity;
    const to = filter.to ? new Date(filter.to).getTime() + 86_400_000 : Infinity;
    return delay(
      audit.filter((a) => {
        const t = new Date(a.createdAt).getTime();
        return (
          (!filter.action || a.action === filter.action) &&
          (!email || a.email?.includes(email) || a.detail?.toLowerCase().includes(email)) &&
          t >= from &&
          t < to
        );
      })
    );
  },
};

/* ------------ customers ------------ */
const withCounts = (c: Customer): Customer => {
  const rows = [...(customerIntegrations.get(c.id)?.values() ?? [])];
  return { ...c, enabledCount: rows.filter((r) => r.isEnabled).length, configuredCount: rows.filter((r) => r.isConfigured).length };
};

export const customersApi = {
  list: () => delay(customers.map(withCounts)),

  get(id: string) {
    const c = customers.find((x) => x.id === id);
    return c ? delay(withCounts(c)) : fail("Customer not found.");
  },

  // Validated against Genesis exactly like a user sign-in; the old token stays in place if this fails.
  // Mock: a token containing "invalid" is rejected by Genesis, "offline" simulates Genesis being down.
  updateToken(id: string, token: string) {
    const c = customers.find((x) => x.id === id);
    if (!c) return fail("Customer not found.");
    const value = token.trim();
    if (!value) return fail("Enter a token.");
    if (/offline/i.test(value)) return fail("Unable to reach Genesis to validate the token. Try again later.");
    if (/invalid/i.test(value)) {
      log("token_updated", me(), `${c.genesisId}: rejected by Genesis`);
      return fail("Genesis rejected this token. Check it and try again.");
    }
    c.tokenPreview = value.slice(-4);
    c.tokenUpdatedAt = new Date().toISOString();
    log("token_updated", me(), c.genesisId);
    return delay(withCounts(c));
  },

  integrations(id: string): Promise<CustomerIntegrationRow[]> {
    const rows = customerIntegrations.get(id);
    if (!rows) return fail("Customer not found.");
    return delay(
      catalog.map((item) => {
        const r = rows.get(item.id) ?? { isEnabled: false, isConfigured: false, credentialUpdatedAt: null };
        return { integrationId: item.id, name: item.name, badge: item.badge, iconUrl: item.iconUrl, ...r };
      })
    );
  },

  setIntegrationEnabled(id: string, integrationId: string, isEnabled: boolean) {
    const rows = customerIntegrations.get(id);
    const c = customers.find((x) => x.id === id);
    if (!rows || !c) return fail("Customer not found.");
    const row = rows.get(integrationId) ?? { isEnabled: false, isConfigured: false, credentialUpdatedAt: null };
    rows.set(integrationId, { ...row, isEnabled });
    log("integration_toggled", me(), `${c.genesisId} / ${integrationId} → ${isEnabled ? "on" : "off"}`);
    return delay(true);
  },
};

/* ------------ catalog ------------ */
export type CatalogInput = Omit<CatalogItem, "isGlobalActive" | "isComingSoon"> &
  Partial<Pick<CatalogItem, "isGlobalActive" | "isComingSoon">> & { enableForCustomers?: boolean };

export const catalogApi = {
  list: () => delay([...catalog].sort((a, b) => a.name.localeCompare(b.name))),

  create(input: CatalogInput) {
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(input.id)) return fail('ID may only contain letters, digits, "_" or "-" (max 50).');
    if (catalog.some((c) => c.id === input.id)) return fail("An integration with this ID already exists.");
    const { enableForCustomers = true, ...rest } = input;
    const item: CatalogItem = { isGlobalActive: true, isComingSoon: false, ...rest };
    catalog.push(item);
    customerIntegrations.forEach((rows) =>
      rows.set(item.id, { isEnabled: enableForCustomers, isConfigured: false, credentialUpdatedAt: null })
    );
    log("catalog_created", me(), item.id);
    return delay({ ...item, customersAdded: customerIntegrations.size });
  },

  update(id: string, patch: Partial<Omit<CatalogItem, "id">>) {
    const item = catalog.find((c) => c.id === id);
    if (!item) return fail("Integration not found.");
    Object.assign(item, patch);
    log("catalog_updated", me(), `${id}: ${Object.keys(patch).join(", ")}`);
    return delay(item);
  },
};
