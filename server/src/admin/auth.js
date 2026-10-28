import crypto from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';

// Admin console auth: email + password, session JWT (cookie `admin_sid` or Bearer), audit log.

const scrypt = promisify(crypto.scrypt);

/* ------------ passwords (scrypt, built into Node: no native dependency) ------------ */
// Stored as scrypt$N$r$p$salt$hash (base64url)
const SCRYPT = { N: 1 << 15, r: 8, p: 1, keylen: 64 };
const SCRYPT_MAXMEM = 128 * SCRYPT.N * SCRYPT.r * 2;

export const MIN_PASSWORD_LENGTH = 12;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: SCRYPT_MAXMEM });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

export async function verifyPassword(password, stored) {
  const [algo, N, r, p, salt, hash] = String(stored).split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scrypt(password, Buffer.from(salt, 'base64url'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: 128 * Number(N) * Number(r) * 2,
  });
  return crypto.timingSafeEqual(actual, expected);
}

// Readable temporary password shown once to the admin who created/reset the account
export function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(16);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/* ------------ lockout ------------ */
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

export const isLocked = (user) => !!user.lockoutEnd && user.lockoutEnd > new Date();

/* ------------ session ------------ */
const SESSION_AUDIENCE = 'admin';
export const ADMIN_SESSION_TTL_SEC = 8 * 60 * 60;
export const ADMIN_COOKIE = 'admin_sid';

export function signAdminSession(user, secret) {
  return jwt.sign({ sub: user.id }, secret, { audience: SESSION_AUDIENCE, expiresIn: ADMIN_SESSION_TTL_SEC });
}

function readToken(req) {
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return req.cookies?.[ADMIN_COOKIE];
}

// Public shape of an AdminUser (never the password hash)
export const toAdminDto = (u) => ({
  id: u.id,
  email: u.email,
  isActive: u.isActive,
  mustChangePassword: u.mustChangePassword,
  failedLoginCount: u.failedLoginCount,
  lockoutEnd: u.lockoutEnd,
  lastLoginAt: u.lastLoginAt,
  createdAt: u.createdAt,
  createdBy: u.createdBy,
  modifiedAt: u.modifiedAt,
  modifiedBy: u.modifiedBy,
});

/**
 * Sets req.admin (AdminUser) from the session, or req.admin = null for the x-admin-key shared secret
 * (scripts/Postman; their changes are stamped as system).
 * allowPasswordChange: let users with a temporary password reach this route (change-password, me, logout).
 */
export function createRequireAdmin({ prisma, secret, adminApiKey, safeEqual }) {
  return ({ allowPasswordChange = false } = {}) =>
    async (req, res, next) => {
      const key = req.headers['x-admin-key'];
      if (key) {
        if (!adminApiKey || !safeEqual(key, adminApiKey)) return res.status(401).json({ error: 'unauthorized' });
        req.admin = null;
        return next();
      }

      const token = readToken(req);
      if (!token) return res.status(401).json({ error: 'unauthorized' });
      let claims;
      try {
        claims = jwt.verify(token, secret, { audience: SESSION_AUDIENCE });
      } catch {
        return res.status(401).json({ error: 'unauthorized' });
      }

      try {
        const user = await prisma.adminUser.findUnique({ where: { id: String(claims.sub) } });
        // Deactivated, or the password changed after this session was issued -> signed out
        const issuedAt = new Date(claims.iat * 1000);
        const stale = user?.passwordChangedAt && user.passwordChangedAt.getTime() > issuedAt.getTime() + 1000;
        if (!user || !user.isActive || stale) return res.status(401).json({ error: 'unauthorized' });
        if (user.mustChangePassword && !allowPasswordChange) {
          return res.status(403).json({ error: 'password_change_required' });
        }
        req.admin = user;
        next();
      } catch (error) {
        console.error('requireAdmin error:', error);
        res.status(500).json({ error: 'Database error' });
      }
    };
}

/* ------------ audit ------------ */
// Never throws: a failed audit write must not fail the request (it is logged instead)
export function createAudit(prisma) {
  return async (req, action, { detail = null, email, userId } = {}) => {
    try {
      await prisma.adminAuditLog.create({
        data: {
          action,
          email: email !== undefined ? email : req.admin?.email ?? null,
          detail: detail ? String(detail).slice(0, 500) : null,
          ip: (req.ip || '').slice(0, 45) || null,
          createdBy: userId !== undefined ? userId : req.admin?.id ?? null,
        },
      });
    } catch (error) {
      console.error('audit write failed:', action, error?.message || error);
    }
  };
}

// Stamp for writes made by the signed-in admin (null = system / x-admin-key)
export const actorId = (req) => req.admin?.id ?? null;
