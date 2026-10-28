import React, { createContext, useContext, useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { AdminUser, auth } from "./api";
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

const AdminLayout: React.FC = () => {
  const { user, logout } = useAdminAuth();

  // First sign-in with a temporary password: force a password change before anything else
  if (user?.mustChangePassword) return <AccountPage forced />;

  return (
    <div className="min-h-screen bg-gray-50 md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="bg-white border-b md:border-b-0 md:border-r border-gray-200 md:min-h-screen flex md:flex-col">
        <div className="px-5 py-5 hidden md:block">
          <p className="text-[16px] font-bold text-gray-950">Trustwell Admin</p>
          <p className="text-[12px] text-gray-500">Integrations console</p>
        </div>
        <nav className="flex md:flex-col gap-1 px-3 py-2 overflow-x-auto flex-1" aria-label="Admin">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded-[6px] text-[14px] whitespace-nowrap transition-colors ${
                  isActive ? "bg-[#EEF2FF] text-[#3730A3] font-semibold" : "text-gray-700 hover:bg-gray-100"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden md:block border-t border-gray-200 px-5 py-4">
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
