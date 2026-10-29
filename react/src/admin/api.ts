// Admin console API client (server: server/src/admin/routes.js, mounted at /api/admin).
// Session: the server sets an HttpOnly `admin_sid` cookie and also returns the token, which is sent
// as a Bearer header in case the browser blocks the cookie (frontend and API on different hosts).

const base = import.meta.env.VITE_SERVER_URL as string;
const STORAGE_KEY = "embedkit_admin_token";

// Two-factor sign-in (TOTP). Off for now: hides every MFA control in the console (no server support yet).
export const MFA_ENABLED = false;

/* ------------ types (mirror the DB tables) ------------ */
// *ByEmail = admin who made the change; null = system, customer, or data from before stamps existed
interface Stamps {
  createdAt: string | null;
  createdByEmail?: string | null;
  modifiedAt: string | null;
  modifiedByEmail?: string | null;
}

export interface AdminUser extends Stamps {
  id: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  failedLoginCount: number;
  lockoutEnd: string | null;
  lastLoginAt: string | null;
  mfaEnabled?: boolean;
}

export type AuditAction =
  | "login_success"
  | "login_failed"
  | "logout"
  | "user_created"
  | "user_updated"
  | "password_reset"
  | "token_updated"
  | "token_rejected"
  | "integration_toggled"
  | "catalog_created"
  | "catalog_updated"
  | "catalog_deleted";

export interface AuditLog {
  id: number;
  createdBy: string | null;
  email: string | null;
  action: AuditAction;
  detail: string | null;
  createdAt: string;
}

export interface Customer extends Stamps {
  id: string;
  genesisId: string;
  customerName: string | null;
  tokenPreview: string; // last 4 chars only; the full token never leaves the server
  enabledCount: number;
  configuredCount: number;
}

export interface CatalogItem extends Partial<Stamps> {
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
  isGlobalActive: boolean;
  isComingSoon: boolean;
  isEnabled: boolean;
  isConfigured: boolean;
  credentialUpdatedAt: string | null;
  modifiedAt: string | null;
  modifiedByEmail: string | null;
}

/* ------------ http ------------ */
let memoryToken: string | null = null;

function readToken() {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = sessionStorage.getItem(STORAGE_KEY);
  } catch {}
  return memoryToken;
}

function writeToken(token: string | null) {
  memoryToken = token;
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// AdminApp registers this to send the user back to the sign-in page when the session ends
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

// Server error codes -> messages shown in the UI
const MESSAGES: Record<string, string> = {
  invalid_credentials: "Invalid email or password.",
  locked: "This account is locked after too many failed sign-ins. Try again later or ask another admin to unlock it.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  wrong_current_password: "Current password is incorrect.",
  password_too_short: "New password must be at least 12 characters.",
  password_unchanged: "Choose a password different from the current one.",
  password_change_required: "Change your password to continue.",
  invalid_email: "Enter a valid email address.",
  email_already_exists: "A user with this email already exists.",
  cannot_deactivate_self: "You cannot deactivate your own account.",
  invalid_token: "This token was rejected. Check it and try again.",
  genesis_unreachable: "Unable to validate the token right now. Try again later.",
  id_already_exists: "An integration with this ID already exists.",
  in_use: "This integration is used by customers. Turn it off instead of deleting it.",
  not_found: "Not found.",
};

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  const token = readToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (json !== undefined) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(`${base}/api/admin${path}`, {
      ...rest,
      headers,
      credentials: "include",
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "network", "Unable to reach the server.");
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const code: string = typeof body?.error === "string" ? body.error : "error";
    if (res.status === 401 && code === "unauthorized") {
      writeToken(null);
      onUnauthorized?.();
    }
    throw new ApiError(res.status, code, MESSAGES[code] ?? body?.detail ?? code);
  }
  return body as T;
}

const qs = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v && search.set(k, v));
  const s = search.toString();
  return s ? `?${s}` : "";
};

/* ------------ auth ------------ */
export const auth = {
  // null = not signed in (works with either the stored token or the cookie)
  me: () => request<AdminUser>("/auth/me").catch(() => null),

  async login(email: string, password: string): Promise<{ mfaRequired: boolean; mustChangePassword: boolean }> {
    const { token, user } = await request<{ token: string; user: AdminUser }>("/auth/login", {
      method: "POST",
      json: { email, password },
    });
    writeToken(token);
    return { mfaRequired: false, mustChangePassword: user.mustChangePassword };
  },

  // MFA is not implemented on the server yet (MFA_ENABLED = false)
  verifyMfa(_code: string): Promise<{ mfaRequired: boolean; mustChangePassword: boolean }> {
    return Promise.reject(new Error("Two-factor sign-in is not available."));
  },

  async logout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } catch {
      // Already signed out on the server
    }
    writeToken(null);
    return true;
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const { token } = await request<{ token: string }>("/auth/change-password", {
      method: "POST",
      json: { currentPassword, newPassword },
    });
    writeToken(token);
    return true;
  },
};

/* ------------ users ------------ */
export const usersApi = {
  list: () => request<AdminUser[]>("/users"),

  create: (email: string, _enableMfa = false) =>
    request<{ user: AdminUser; temporaryPassword: string }>("/users", { method: "POST", json: { email } }),

  setActive: (id: string, isActive: boolean) => request<AdminUser>(`/users/${id}`, { method: "PATCH", json: { isActive } }),

  resetPassword: (id: string) => request<{ temporaryPassword: string }>(`/users/${id}/reset-password`, { method: "POST" }),

  unlock: (id: string) => request<AdminUser>(`/users/${id}/unlock`, { method: "POST" }),

  resetMfa: (_id: string): Promise<AdminUser> => Promise.reject(new Error("Two-factor sign-in is not available.")),
};

/* ------------ audit ------------ */
export interface AuditFilter {
  action?: AuditAction | "";
  email?: string; // matches email or detail
  from?: string;
  to?: string;
}

export const auditApi = {
  list: (filter: AuditFilter = {}) =>
    request<AuditLog[]>(`/audit${qs({ action: filter.action, q: filter.email?.trim(), from: filter.from, to: filter.to })}`),
};

/* ------------ customers ------------ */
export const customersApi = {
  list: () => request<Customer[]>("/customers"),

  get: (id: string) => request<Customer>(`/customers/${id}`),

  // Validated with Genesis on the server like a customer sign-in; the old token stays if it fails
  updateToken: (id: string, token: string) => request<Customer>(`/customers/${id}/token`, { method: "PUT", json: { token } }),

  integrations: (id: string) => request<CustomerIntegrationRow[]>(`/customers/${id}/integrations`),

  setIntegrationEnabled: (id: string, integrationId: string, isEnabled: boolean) =>
    request<{ ok: true }>(`/customers/${id}/integrations/${encodeURIComponent(integrationId)}`, {
      method: "PATCH",
      json: { isEnabled },
    }),
};

/* ------------ catalog ------------ */
export type CatalogInput = Pick<CatalogItem, "id" | "name" | "category" | "iconUrl" | "badge"> &
  Partial<Pick<CatalogItem, "isGlobalActive" | "isComingSoon">> & { enableForCustomers?: boolean };

type CatalogPatch = Partial<Pick<CatalogItem, "name" | "category" | "iconUrl" | "badge" | "isGlobalActive" | "isComingSoon">>;

export const catalogApi = {
  list: () => request<CatalogItem[]>("/catalog"),

  create: (input: CatalogInput) =>
    request<CatalogItem & { customersAdded: number }>("/catalog", { method: "POST", json: input }),

  update: (id: string, patch: CatalogPatch) =>
    request<CatalogItem>(`/catalog/${encodeURIComponent(id)}`, { method: "PATCH", json: patch }),
};
