import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { customersApi } from "../api";
import { Card, formatDate, inputClass, LoadState, PageHeader, Td, Table, useAsync } from "../ui";

export const CustomersPage: React.FC = () => {
  const { data, loading, error } = useAsync(() => customersApi.list());
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter(
      (c) => !q || c.genesisId.toLowerCase().includes(q) || c.customerName?.toLowerCase().includes(q)
    );
  }, [data, query]);

  return (
    <>
      <PageHeader
        title="Customers & tokens"
        description="Genesis customers, their auth token and how many integrations each one has enabled."
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="search"
          placeholder="Search by name or Genesis ID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${inputClass} max-w-xs`}
          aria-label="Search customers"
        />
      </div>

      <Card>
        <LoadState loading={loading} error={error} empty={!rows.length} emptyText="No customers match." />
        {!loading && !error && rows.length > 0 && (
          <Table head={["Customer", "Genesis ID", "Token", "Token updated", "Integrations", ""]}>
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <Td className="font-medium text-gray-950">{c.customerName || <span className="text-gray-500">Unnamed</span>}</Td>
                <Td className="font-mono text-[13px]">{c.genesisId}</Td>
                <Td>
                  <span className="font-mono text-[12px] text-gray-500">••••{c.tokenPreview}</span>
                </Td>
                <Td className="whitespace-nowrap">{formatDate(c.tokenUpdatedAt)}</Td>
                <Td className="whitespace-nowrap text-gray-700">
                  {c.enabledCount} enabled · {c.configuredCount} connected
                </Td>
                <Td className="text-right">
                  <Link to={`/admin/customers/${c.id}`} className="text-[13px] font-semibold text-[#4338CA] hover:underline whitespace-nowrap">
                    Manage →
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
};
