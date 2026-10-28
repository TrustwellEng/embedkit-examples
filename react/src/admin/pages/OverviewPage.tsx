import React from "react";
import { Link } from "react-router-dom";
import { auditApi, catalogApi, customersApi, usersApi } from "../api";
import { Card, formatDate, LoadState, PageHeader, Td, Table, useAsync } from "../ui";

const Stat: React.FC<{ label: string; value: number | string; to: string; tone?: "red" | "amber" }> = ({ label, value, to, tone }) => (
  <Link to={to} className="block">
    <Card className="p-5 hover:border-[#4F46E5] transition-colors">
      <p className="text-[13px] text-gray-600">{label}</p>
      <p
        className={`text-[28px] font-bold mt-1 ${
          tone === "red" ? "text-[#B91C1C]" : tone === "amber" ? "text-[#B45309]" : "text-gray-950"
        }`}
      >
        {value}
      </p>
    </Card>
  </Link>
);

const RECENT_ACTIVITY = 6;

export const OverviewPage: React.FC = () => {
  const { data, loading, error } = useAsync(() =>
    Promise.all([customersApi.list(), catalogApi.list(), usersApi.list(), auditApi.list()])
  );

  if (!data) return <LoadState loading={loading} error={error} />;
  const [customers, catalog, users, audit] = data;

  const locked = users.filter((u) => u.lockoutEnd && new Date(u.lockoutEnd) > new Date()).length;
  const failed24h = audit.filter((a) => a.action === "login_failed" && Date.now() - new Date(a.createdAt).getTime() < 86_400_000).length;

  return (
    <>
      <PageHeader title="Overview" description="Customers, integrations and recent admin activity at a glance." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat label="Customers" value={customers.length} to="/admin/customers" />
        <Stat label="Admin users" value={users.filter((u) => u.isActive).length} to="/admin/users" />
        <Stat label="Integrations shown to customers" value={`${catalog.filter((c) => c.isGlobalActive).length} of ${catalog.length}`} to="/admin/catalog" />
        <Stat label="Failed sign-ins (24h)" value={failed24h} to="/admin/audit" tone={failed24h ? "amber" : undefined} />
      </div>

      <Card className="mb-8">
        <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-gray-950">Recent activity</h2>
          <Link to="/admin/audit" className="text-[13px] font-semibold text-[#4338CA] hover:underline">
            View audit log →
          </Link>
        </div>
        <Table head={["Time", "User", "Action", "Detail"]}>
          {audit.slice(0, RECENT_ACTIVITY).map((a) => (
            <tr key={a.id}>
              <Td className="whitespace-nowrap text-gray-700">{formatDate(a.createdAt)}</Td>
              <Td className="text-gray-950">{a.email ?? "Unknown"}</Td>
              <Td className="font-mono text-[13px] text-gray-700">{a.action}</Td>
              <Td className="text-gray-700">{a.detail ?? "—"}</Td>
            </tr>
          ))}
        </Table>
      </Card>

      {locked > 0 && (
        <Card className="p-4 text-[14px] text-gray-700">
          {locked} admin account(s) are locked after failed sign-ins.{" "}
          <Link to="/admin/users" className="font-semibold text-[#4338CA] hover:underline">
            Review users →
          </Link>
        </Card>
      )}
    </>
  );
};
