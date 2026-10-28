import React, { useEffect, useState } from "react";

export { Field, inputClass, primaryButtonClass, secondaryButtonClass } from "../pages/wizard/ui";

export const smallButtonClass =
  "px-3 py-1.5 text-[13px] font-medium text-gray-800 bg-white border border-gray-300 rounded-[6px] hover:bg-gray-100 disabled:opacity-50 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] transition-colors";
export const dangerButtonClass =
  "px-3 py-1.5 text-[13px] font-medium text-[#B91C1C] bg-white border border-[#FCA5A5] rounded-[6px] hover:bg-[#FEF2F2] disabled:opacity-50 transition-colors";

export const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

/* ------------ data loading ------------ */
export function useAsync<T>(load: () => Promise<T>, deps: React.DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load()
      .then(
        (d) => {
          if (!alive) return;
          setData(d);
          setError(null);
          setLoading(false);
        },
        (e) => {
          if (!alive) return;
          setError(e?.message || "Something went wrong.");
          setLoading(false);
        }
      );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  return { data, setData, error, loading, reload: () => setVersion((v) => v + 1) };
}

/* ------------ layout ------------ */
export const PageHeader: React.FC<{ title: string; description?: string; actions?: React.ReactNode }> = ({
  title,
  description,
  actions,
}) => (
  <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
    <div>
      <h1 className="text-xl font-bold text-gray-950">{title}</h1>
      {description && <p className="text-[14px] text-gray-600 mt-1">{description}</p>}
    </div>
    {actions && <div className="flex gap-2">{actions}</div>}
  </div>
);

export const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className = "", children }) => (
  <div className={`bg-white text-gray-900 border border-gray-200 rounded-[12px] ${className}`}>{children}</div>
);

export const LoadState: React.FC<{ loading: boolean; error: string | null; empty?: boolean; emptyText?: string }> = ({
  loading,
  error,
  empty,
  emptyText = "Nothing here yet.",
}) => {
  if (loading) return <p className="p-6 text-[14px] text-gray-500">Loading...</p>;
  if (error) return <p className="p-6 text-[14px] text-red-600">{error}</p>;
  if (empty) return <p className="p-6 text-[14px] text-gray-500">{emptyText}</p>;
  return null;
};

export const ErrorText: React.FC<{ error: string | null }> = ({ error }) =>
  error ? <p className="text-[13px] text-red-600">{error}</p> : null;

/* "date" + "by email" for the created/modified stamps; no email = system, customer or old data */
export const ChangedBy: React.FC<{ at: string | null | undefined; by: string | null | undefined }> = ({ at, by }) => (
  <div className="whitespace-nowrap">
    <div className="text-gray-700">{formatDate(at ?? null)}</div>
    <div className="text-[12px] text-gray-500">{by ? `by ${by}` : at ? "by system" : ""}</div>
  </div>
);

/* ------------ table ------------ */
export const Table: React.FC<React.PropsWithChildren<{ head: string[] }>> = ({ head, children }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left text-[14px] text-gray-900">
      <thead className="bg-gray-50 text-[12px] uppercase tracking-wide text-gray-600">
        <tr>
          {head.map((h) => (
            <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">{children}</tbody>
    </table>
  </div>
);

export const Td: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className = "", children }) => (
  <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>
);

/* ------------ badges ------------ */
type Tone = "green" | "amber" | "red" | "gray" | "indigo";
const TONES: Record<Tone, string> = {
  green: "bg-[#DCFCE7] text-[#166534]",
  amber: "bg-[#FEF3C7] text-[#92400E]",
  red: "bg-[#FEE2E2] text-[#991B1B]",
  gray: "bg-gray-100 text-gray-700",
  indigo: "bg-[#E0E7FF] text-[#3730A3]",
};

export const Badge: React.FC<React.PropsWithChildren<{ tone: Tone }>> = ({ tone, children }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold whitespace-nowrap ${TONES[tone]}`}>
    {children}
  </span>
);

/* ------------ toggle ------------ */
export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }> = ({
  checked,
  onChange,
  label,
  disabled,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] ${
      checked ? "bg-[#4F46E5]" : "bg-gray-300"
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`}
    />
  </button>
);

/* ------------ modal ------------ */
export const Modal: React.FC<React.PropsWithChildren<{ title: string; onClose: () => void }>> = ({ title, onClose, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg bg-white text-gray-900 rounded-[12px] shadow-xl p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] font-bold text-gray-950">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-900 text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

/* Shows a one-time secret (temporary password) with a copy button */
export const SecretBox: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-[6px] px-3 py-2">
      <code className="flex-1 font-mono text-[14px] text-gray-950 break-all">{value}</code>
      <button
        type="button"
        className={smallButtonClass}
        onClick={() => navigator.clipboard?.writeText(value).then(() => setCopied(true))}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
};
