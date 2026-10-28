import React, { useState } from "react";
import { CatalogItem, catalogApi } from "../api";
import {
  Badge,
  Card,
  ChangedBy,
  ErrorText,
  Field,
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

const TIERS = ["Standard", "Premium"];

type FormState = { id: string; name: string; category: string; iconUrl: string; badge: string; isComingSoon: boolean; enableForCustomers: boolean };

const emptyForm: FormState = { id: "", name: "", category: "", iconUrl: "", badge: "Standard", isComingSoon: false, enableForCustomers: true };

// Add (item = null) or edit an IntegrationsCatalog row
const CatalogFormModal: React.FC<{ item: CatalogItem | null; onClose: () => void; onSaved: () => void }> = ({ item, onClose, onSaved }) => {
  const editing = !!item;
  const [form, setForm] = useState<FormState>(
    item ? { ...emptyForm, ...item, iconUrl: item.iconUrl ?? "", badge: item.badge ?? "" } : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fields = {
      name: form.name.trim(),
      category: form.category.trim(),
      iconUrl: form.iconUrl.trim() || null,
      badge: form.badge || null,
      isComingSoon: form.isComingSoon,
    };
    try {
      if (editing) {
        await catalogApi.update(item.id, fields);
        onSaved();
      } else {
        const created = await catalogApi.create({ id: form.id.trim(), ...fields, enableForCustomers: form.enableForCustomers });
        setResult(`${created.name} was added and given to ${created.customersAdded} customer(s).`);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <Modal title="Integration added" onClose={onSaved}>
        <p className="text-[14px] text-gray-700 mb-6">{result}</p>
        <div className="flex justify-end">
          <button type="button" onClick={onSaved} className={primaryButtonClass}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={editing ? `Edit ${item.name}` : "Add integration"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="ID" htmlFor="cat-id" hint={editing ? "The ID cannot be changed." : 'Used in URLs and the database. Letters, digits, "_" or "-".'}>
          <input
            id="cat-id"
            required
            disabled={editing}
            pattern="[A-Za-z0-9_\-]{1,50}"
            value={form.id}
            onChange={(e) => set("id", e.target.value)}
            className={`${inputClass} font-mono disabled:bg-gray-100`}
            placeholder="oracle_plm"
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Name" htmlFor="cat-name">
            <input id="cat-name" required maxLength={100} value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Category" htmlFor="cat-category">
            <input id="cat-category" required maxLength={50} value={form.category} onChange={(e) => set("category", e.target.value)} className={inputClass} placeholder="ERP" />
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Tier" htmlFor="cat-badge">
            <select id="cat-badge" value={form.badge} onChange={(e) => set("badge", e.target.value)} className={inputClass}>
              {TIERS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Icon URL" htmlFor="cat-icon">
            <input id="cat-icon" type="url" maxLength={500} value={form.iconUrl} onChange={(e) => set("iconUrl", e.target.value)} className={inputClass} placeholder="https://..." />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[14px] text-gray-800">
          <input type="checkbox" checked={form.isComingSoon} onChange={(e) => set("isComingSoon", e.target.checked)} />
          Show as "Coming soon" (visible but cannot be opened)
        </label>
        {!editing && (
          <label className="flex items-center gap-2 text-[14px] text-gray-800">
            <input type="checkbox" checked={form.enableForCustomers} onChange={(e) => set("enableForCustomers", e.target.checked)} />
            Enable for all existing customers
          </label>
        )}
        <ErrorText error={error} />
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? "Saving..." : editing ? "Save changes" : "Add integration"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const CatalogPage: React.FC = () => {
  const { data, setData, loading, error, reload } = useAsync(() => catalogApi.list());
  const [editing, setEditing] = useState<CatalogItem | null | undefined>(undefined); // undefined = closed, null = new
  const [rowError, setRowError] = useState<string | null>(null);

  const patch = async (item: CatalogItem, change: Partial<CatalogItem>) => {
    setRowError(null);
    setData((rows) => rows?.map((r) => (r.id === item.id ? { ...r, ...change } : r)) ?? rows);
    try {
      await catalogApi.update(item.id, change);
      reload();
    } catch (err: any) {
      setRowError(err?.message || "Failed to update.");
      reload();
    }
  };

  return (
    <>
      <PageHeader
        title="Integrations catalog"
        description={'Every integration offered to customers. "Shown to customers" hides or shows it for all customers at once; to turn one off for a single customer, use "Enabled" on that customer.'}
        actions={
          <button type="button" onClick={() => setEditing(null)} className={primaryButtonClass}>
            + Add integration
          </button>
        }
      />

      <Card>
        {rowError && <p className="px-4 pt-3 text-[13px] text-red-600">{rowError}</p>}
        <LoadState loading={loading && !data} error={error} empty={data?.length === 0} />
        {data && data.length > 0 && (
          <Table head={["Integration", "ID", "Category", "Tier", "Coming soon", "Shown to customers", "Last changed", ""]}>
            {data.map((item) => (
              <tr key={item.id} className={item.isGlobalActive ? "" : "bg-gray-50"}>
                <Td>
                  <div className="flex items-center gap-3">
                    {item.iconUrl ? (
                      <img src={item.iconUrl} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                      <span className="w-6 h-6 rounded bg-gray-100" aria-hidden="true" />
                    )}
                    <span className={`font-medium ${item.isGlobalActive ? "text-gray-950" : "text-gray-500"}`}>{item.name}</span>
                  </div>
                </Td>
                <Td className="font-mono text-[13px] text-gray-600">{item.id}</Td>
                <Td>{item.category}</Td>
                <Td>{item.badge ? <Badge tone={item.badge === "Premium" ? "indigo" : "gray"}>{item.badge}</Badge> : "—"}</Td>
                <Td>
                  <Toggle checked={item.isComingSoon} onChange={(v) => patch(item, { isComingSoon: v })} label={`${item.name} coming soon`} />
                </Td>
                <Td>
                  <Toggle checked={item.isGlobalActive} onChange={(v) => patch(item, { isGlobalActive: v })} label={`Show ${item.name} to all customers`} />
                </Td>
                <Td>
                  <ChangedBy at={item.modifiedAt} by={item.modifiedByEmail} />
                </Td>
                <Td className="text-right">
                  <button type="button" onClick={() => setEditing(item)} className={smallButtonClass}>
                    Edit
                  </button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {editing !== undefined && (
        <CatalogFormModal
          item={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            reload();
          }}
        />
      )}
    </>
  );
};
