import React, { createContext, useContext, useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AdminUser, auth, setUnauthorizedHandler } from "./api";
import { LoginPage } from "./pages/LoginPage";
import { OverviewPage } from "./pages/OverviewPage";
import { UsersPage } from "./pages/UsersPage";
import { AuditPage } from "./pages/AuditPage";
import { CustomersPage } from "./pages/CustomersPage";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { CatalogPage } from "./pages/CatalogPage";
import { AccountPage } from "./pages/AccountPage";

/* ------------ admin session ------------ */
interface AdminAuth {
  user: AdminUser | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuth | null>(null);

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used inside <AdminApp>");
  return ctx;
};

// Sign the admin out after this much inactivity
const IDLE_TIMEOUT_MS = 15 * 60_000;

function useIdleLogout(active: boolean, onIdle: () => void) {
  useEffect(() => {
    if (!active) return;
    let timer = window.setTimeout(onIdle, IDLE_TIMEOUT_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onIdle, IDLE_TIMEOUT_MS);
    };
    const events = ["mousemove", "keydown", "click", "scroll"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [active, onIdle]);
}

/* ------------ layout ------------ */
const NAV = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/customers", label: "Customers & tokens" },
  { to: "/admin/catalog", label: "Integrations catalog" },
  { to: "/admin/users", label: "Admin users" },
  { to: "/admin/audit", label: "Audit log" },
  { to: "/admin/account", label: "My account" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-[6px] text-[14px] whitespace-nowrap transition-colors ${
    isActive ? "bg-[#EEF2FF] text-[#3730A3] font-semibold" : "text-gray-700 hover:bg-gray-100"
  }`;

// onNavigate: also called when tapping the page you're already on (the URL doesn't change then)
const NavLinks: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => (
  <>
    {NAV.map((n) => (
      <NavLink key={n.to} to={n.to} end={n.end} className={navLinkClass} onClick={onNavigate}>
        {n.label}
      </NavLink>
    ))}
  </>
);

const menuButtonClass =
  "inline-flex items-center justify-center w-9 h-9 rounded-[6px] text-gray-700 hover:bg-gray-100 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px]";

const AdminLayout: React.FC = () => {
  const { user, logout } = useAdminAuth();
  const { pathname } = useLocation();
  // Small screens: full-screen menu that slides in from the right; closes after picking a page
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    // Keep the page behind the menu from scrolling
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [menuOpen]);

  // First sign-in with a temporary password: force a password change before anything else
  if (user?.mustChangePassword) return <AccountPage forced />;

  const title = <p className="text-[16px] font-bold text-gray-950">Trustwell Admin</p>;

  // Note: main.css forces `.hidden` with !important, so responsive hiding uses max-md:hidden / md:hidden instead
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      {/* Small screens: top bar with the menu button */}
      <header className="md:hidden flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-gray-200">
        {title}
        <button type="button" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-controls="admin-mobile-nav" aria-label="Open menu" className={menuButtonClass}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      {/* Small screens: full-screen menu, slides in from the right */}
      <div
        id="admin-mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!menuOpen}
        inert={!menuOpen}
        className={`md:hidden fixed inset-0 z-50 flex flex-col bg-white transition-transform duration-200 ease-out ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200">
          {title}
          <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className={menuButtonClass}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <nav aria-label="Admin" className="flex flex-col gap-1 px-3 py-3 flex-1 overflow-y-auto">
          <NavLinks onNavigate={() => setMenuOpen(false)} />
        </nav>
        <div className="border-t border-gray-200 px-5 py-4">
          <p className="text-[13px] text-gray-600 truncate">{user?.email}</p>
          <button type="button" onClick={logout} className="mt-1 py-1 text-[14px] font-medium text-[#4338CA] hover:underline">
            Sign out
          </button>
        </div>
      </div>

      {/* Desktop: sidebar pinned to the screen */}
      <aside className="max-md:hidden min-w-0 bg-white border-r border-gray-200 sticky top-0 h-screen flex flex-col">
        <div className="px-5 py-5">
          {title}
          <p className="text-[12px] text-gray-500">Integrations console</p>
        </div>
        <nav aria-label="Admin" className="flex flex-col gap-1 px-3 py-2 flex-1 overflow-y-auto">
          <NavLinks />
        </nav>
        <div className="border-t border-gray-200 px-5 py-4">
          <p className="text-[13px] text-gray-950 truncate" title={user?.email}>
            {user?.email}
          </p>
          <button type="button" onClick={logout} className="mt-2 text-[13px] font-medium text-[#4338CA] hover:underline">
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-8">
        <div className="max-w-[1200px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const RequireAdmin: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { user } = useAdminAuth();
  return user ? <>{children}</> : <Navigate to="/admin/login" replace />;
};

/* ------------ entry: mounted at /admin/* ------------ */
export const AdminApp: React.FC = () => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  const refresh = async () => setUser(await auth.me());
  const logout = React.useCallback(async () => {
    await auth.logout();
    setUser(null);
    navigate("/admin/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    refresh().then(
      () => setReady(true),
      () => setReady(true)
    );
  }, []);

  // Session expired or revoked (deactivated, password reset) -> back to sign-in
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      navigate("/admin/login", { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  useIdleLogout(!!user, logout);

  if (!ready) return <p className="p-8 text-gray-500">Loading...</p>;

  return (
    <AdminAuthContext.Provider value={{ user, refresh, logout }}>
      <Routes>
        <Route path="login" element={user ? <Navigate to="/admin" replace /> : <LoginPage />} />
        <Route
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="customers/:id" element={<CustomerDetailPage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </AdminAuthContext.Provider>
  );
};

export default AdminApp;
