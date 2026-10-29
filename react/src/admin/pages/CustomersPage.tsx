import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { customersApi } from "../api";
import { Card, ChangedBy, inputClass, LoadState, PageHeader, smallButtonClass, Td, Table, useAsync } from "../ui";

const SEARCH_DELAY_MS = 300;

export const CustomersPage: React.FC = () => {
  // Page and search live in the URL so "← Customers" from a detail page returns to the same page
  const [params, setParams] = useSearchParams();
  const page = Math.max(Number(params.get("page")) || 1, 1);
  const q = params.get("q") ?? "";
  const [query, setQuery] = useState(q);

  const { data, loading, error } = useAsync(() => customersApi.list(page, q), [page, q]);
  const rows = data?.items ?? [];
  const totalPages = data ? Math.max(Math.ceil(data.total / data.pageSize), 1) : 1;

  const go = (nextPage: number, nextQ = q) => {
    const next = new URLSearchParams();
    if (nextPage > 1) next.set("page", String(nextPage));
    if (nextQ) next.set("q", nextQ);
    setParams(next);
  };

  // Search after typing stops; a new search starts at page 1
  useEffect(() => {
    const value = query.trim();
    if (value === q) return;
    const timer = window.setTimeout(() => go(1, value), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <>
      <PageHeader
        title="Customers & tokens"
        description="Customers, their auth token and how many integrations each one has enabled."
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="search"
          placeholder="Search by customer ID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${inputClass} max-w-xs`}
          aria-label="Search customers"
        />
      </div>

      <Card>
        <LoadState loading={loading && !data} error={error} empty={!!data && !rows.length} emptyText="No customers match." />
        {!error && rows.length > 0 && (
          <Table head={["Customer ID", "Token", "Last changed", "Integrations", ""]}>
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <Td className="font-mono text-[13px] font-medium text-gray-950">{c.genesisId}</Td>
                <Td>
                  <span className="font-mono text-[12px] text-gray-500">••••{c.tokenPreview}</span>
                </Td>
                <Td>
                  <ChangedBy at={c.modifiedAt ?? c.createdAt} by={c.modifiedByEmail} />
                </Td>
                <Td className="whitespace-nowrap text-gray-700">
                  {c.enabledCount} enabled · {c.configuredCount} connected
                </Td>
                <Td className="text-right">
                  <Link to={`/admin/customers/${c.id}`} state={{ back: `/admin/customers?${params}` }} className="text-[13px] font-semibold text-[#4338CA] hover:underline whitespace-nowrap">
                    Manage →
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
        )}
        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 text-[13px] text-gray-700">
            <span>
              Showing {(data.page - 1) * data.pageSize + 1}–{(data.page - 1) * data.pageSize + rows.length} of {data.total}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" className={smallButtonClass} disabled={page <= 1 || loading} onClick={() => go(page - 1)}>
                ← Previous
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button type="button" className={smallButtonClass} disabled={page >= totalPages || loading} onClick={() => go(page + 1)}>
                Next →
              </button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
};
