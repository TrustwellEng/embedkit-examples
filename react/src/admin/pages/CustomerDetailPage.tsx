import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Customer, customersApi } from "../api";
import {
  Badge,
  Card,
  ChangedBy,
  ErrorText,
  Field,
  formatDate,
  inputClass,
  LoadState,
  Modal,
  PageHeader,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
  Td,
  Table,
  Toggle,
  useAsync,
} from "../ui";

const UpdateTokenModal: React.FC<{ customer: Customer; onClose: () => void; onSaved: (c: Customer) => void }> = ({
  customer,
  onClose,
  onSaved,
}) => {
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(await customersApi.updateToken(customer.id, token));
    } catch (err: any) {
      setError(err?.message || "Failed to update token.");
      setSaving(false);
    }
  };

  return (
    <Modal title={`Update token · ${customer.genesisId}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <Field
          label="New auth token"
          htmlFor="new-token"
          hint="Validated the same way as a customer sign-in. The current token is kept if validation fails."
        >
          <input
            id="new-token"
            type="password"
            autoComplete="off"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className={`${inputClass} font-mono`}
          />
        </Field>
        <ErrorText error={error} />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? "Validating..." : "Validate and save"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const CustomerDetailPage: React.FC = () => {
  const { id = "" } = useParams();
  const customer = useAsync(() => customersApi.get(id), [id]);
  const integrations = useAsync(() => customersApi.integrations(id), [id]);
  const [editingToken, setEditingToken] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const toggle = async (integrationId: string, isEnabled: boolean) => {
    setToggleError(null);
    // Optimistic update, rolled back on failure
    integrations.setData((rows) => rows?.map((r) => (r.integrationId === integrationId ? { ...r, isEnabled } : r)) ?? rows);
    try {
      await customersApi.setIntegrationEnabled(id, integrationId, isEnabled);
      customer.reload();
      integrations.reload();
    } catch (err: any) {
      setToggleError(err?.message || "Failed to update integration.");
      integrations.reload();
    }
  };

  const c = customer.data;
  if (!c) return <LoadState loading={customer.loading} error={customer.error} />;

  return (
    <>
      <Link to="/admin/customers" className="inline-block text-[13px] font-medium text-gray-700 hover:text-[#4338CA] mb-4">
        ← Customers
      </Link>
      <PageHeader title={c.customerName || c.genesisId} description={`Customer ID ${c.genesisId} · created ${formatDate(c.createdAt)}`} />

      <Card className="p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-bold text-gray-950 mb-2">Auth token</h2>
            <div className="flex flex-wrap items-center gap-3 text-[14px] text-gray-700">
              <span className="font-mono text-[13px]">••••••••{c.tokenPreview}</span>
              <span className="text-gray-500">
                Last changed {formatDate(c.modifiedAt ?? c.createdAt)} {c.modifiedByEmail ? `by ${c.modifiedByEmail}` : "by system"}
              </span>
            </div>
          </div>
          <button type="button" onClick={() => setEditingToken(true)} className={primaryButtonClass}>
            Update token
          </button>
        </div>
      </Card>

      <Card>
        <div className="px-4 py-4 border-b border-gray-200">
          <h2 className="text-[15px] font-bold text-gray-950">Integrations</h2>
          <p className="text-[13px] text-gray-600 mt-1">
            Turning an integration off shows it as "not included" for this customer. Existing credentials are kept.
          </p>
        </div>
        {toggleError && <p className="px-4 pt-3 text-[13px] text-red-600">{toggleError}</p>}
        <LoadState loading={integrations.loading && !integrations.data} error={integrations.error} />
        {integrations.data && (
          <Table head={["Integration", "Tier", "Connection", "Credentials updated", "Last changed", "Enabled"]}>
            {integrations.data.map((r) => (
              <tr key={r.integrationId}>
                <Td>
                  <div className="flex items-center gap-3">
                    {r.iconUrl ? (
                      <img src={r.iconUrl} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                      <span className="w-6 h-6 rounded bg-gray-100" aria-hidden="true" />
                    )}
                    <span className="font-medium text-gray-950">{r.name}</span>
                    {!r.isGlobalActive && <Badge tone="gray">Hidden for all customers</Badge>}
                    {r.isComingSoon && <Badge tone="amber">Coming soon</Badge>}
                  </div>
                </Td>
                <Td>{r.badge ? <Badge tone={r.badge === "Premium" ? "indigo" : "gray"}>{r.badge}</Badge> : "—"}</Td>
                <Td>{r.isConfigured ? <Badge tone="green">Connected</Badge> : <span className="text-gray-500">Not connected</span>}</Td>
                <Td className="whitespace-nowrap text-gray-700">{formatDate(r.credentialUpdatedAt)}</Td>
                <Td>
                  <ChangedBy at={r.modifiedAt} by={r.modifiedByEmail} />
                </Td>
                <Td>
                  <Toggle checked={r.isEnabled} onChange={(v) => toggle(r.integrationId, v)} label={`Enable ${r.name} for ${c.genesisId}`} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
        <div className="px-4 py-3 border-t border-gray-100">
          <button type="button" onClick={integrations.reload} className={smallButtonClass}>
            Refresh
          </button>
        </div>
      </Card>

      {editingToken && (
        <UpdateTokenModal
          customer={c}
          onClose={() => setEditingToken(false)}
          onSaved={(updated) => {
            customer.setData(updated);
            setEditingToken(false);
          }}
        />
      )}
    </>
  );
};
