import React, { useState } from "react";
import { AuditAction, AuditFilter, auditApi } from "../api";
import { Badge, Card, formatDate, inputClass, LoadState, PageHeader, secondaryButtonClass, Td, Table, useAsync } from "../ui";

const ACTIONS: { value: AuditAction; label: string; tone: "green" | "red" | "gray" | "indigo" | "amber" }[] = [
  { value: "login_success", label: "Sign-in", tone: "green" },
  { value: "login_failed", label: "Failed sign-in", tone: "red" },
  { value: "logout", label: "Sign-out", tone: "gray" },
  { value: "user_created", label: "User created", tone: "indigo" },
  { value: "user_updated", label: "User updated", tone: "indigo" },
  { value: "password_reset", label: "Password reset", tone: "amber" },
  { value: "token_updated", label: "Token updated", tone: "amber" },
  { value: "token_rejected", label: "Token rejected", tone: "red" },
  { value: "integration_toggled", label: "Integration toggled", tone: "indigo" },
  { value: "catalog_created", label: "Catalog added", tone: "indigo" },
  { value: "catalog_updated", label: "Catalog updated", tone: "indigo" },
  { value: "catalog_deleted", label: "Catalog deleted", tone: "red" },
];
const ACTION_META = ACTIONS.reduce<Partial<Record<AuditAction, (typeof ACTIONS)[number]>>>((m, a) => ({ ...m, [a.value]: a }), {});

const toCsv = (rows: string[][]) => rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");

export const AuditPage: React.FC = () => {
  const [filter, setFilter] = useState<AuditFilter>({ action: "", email: "", from: "", to: "" });
  const { data, loading, error } = useAsync(() => auditApi.list(filter), [filter.action, filter.email, filter.from, filter.to]);
  const set = (key: keyof AuditFilter, value: string) => setFilter((f) => ({ ...f, [key]: value }));

  const exportCsv = () => {
    if (!data) return;
    const csv = toCsv([
      ["Time", "User", "Action", "Detail", "IP"],
      ...data.map((a) => [a.createdAt, a.email ?? "", a.action, a.detail ?? "", a.ip ?? ""]),
    ]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "audit-log.csv" });
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Sign-ins, sign-outs and every change made in this console."
        actions={
          <button type="button" onClick={exportCsv} disabled={!data?.length} className={secondaryButtonClass}>
            Export CSV
          </button>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <input
          type="search"
          placeholder="User or detail"
          aria-label="Filter by user or detail"
          value={filter.email}
          onChange={(e) => set("email", e.target.value)}
          className={inputClass}
        />
        <select aria-label="Action" value={filter.action} onChange={(e) => set("action", e.target.value)} className={inputClass}>
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <input type="date" aria-label="From" value={filter.from} onChange={(e) => set("from", e.target.value)} className={inputClass} />
        <input type="date" aria-label="To" value={filter.to} onChange={(e) => set("to", e.target.value)} className={inputClass} />
      </div>

      <Card>
        <LoadState loading={loading && !data} error={error} empty={data?.length === 0} emptyText="No events match these filters." />
        {data && data.length > 0 && (
          <Table head={["Time", "User", "Action", "Detail", "IP"]}>
            {data.map((a) => (
              <tr key={a.id}>
                <Td className="whitespace-nowrap text-gray-700">{formatDate(a.createdAt)}</Td>
                <Td className="text-gray-950">{a.email ?? <span className="text-gray-500">Unknown</span>}</Td>
                <Td>
                  <Badge tone={ACTION_META[a.action]?.tone ?? "gray"}>{ACTION_META[a.action]?.label ?? a.action}</Badge>
                </Td>
                <Td className="text-gray-700">{a.detail ?? "—"}</Td>
                <Td className="font-mono text-[13px] text-gray-600">{a.ip}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
};
