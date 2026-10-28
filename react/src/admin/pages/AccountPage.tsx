import React, { useState } from "react";
import { auth, MFA_ENABLED } from "../api";
import { useAdminAuth } from "../AdminApp";
import { Badge, Card, ErrorText, Field, formatDate, inputClass, PageHeader, primaryButtonClass, secondaryButtonClass } from "../ui";

const MIN_LENGTH = 12;

// Own account: change password. With `forced`, shown full-screen after signing in with a temporary password.
export const AccountPage: React.FC<{ forced?: boolean }> = ({ forced }) => {
  const { user, refresh, logout } = useAdminAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next !== confirm) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await auth.changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setSaved(true);
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to change password.");
    } finally {
      setSaving(false);
    }
  };

  const form = (
    <form onSubmit={submit} className="space-y-5 max-w-md">
      <Field label="Current password" htmlFor="pw-current" hint={forced ? "The temporary password you were given." : undefined}>
        <input id="pw-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
      </Field>
      <Field label="New password" htmlFor="pw-new" hint={`At least ${MIN_LENGTH} characters.`}>
        <input id="pw-new" type="password" autoComplete="new-password" required minLength={MIN_LENGTH} value={next} onChange={(e) => setNext(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Confirm new password" htmlFor="pw-confirm" error={mismatch ? "Passwords do not match." : null}>
        <input id="pw-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
      </Field>
      <ErrorText error={error} />
      {saved && <p className="text-[13px] text-[#15803D]">Password updated.</p>}
      <div className="flex gap-3">
        {forced && (
          <button type="button" onClick={logout} className={secondaryButtonClass}>
            Sign out
          </button>
        )}
        <button type="submit" disabled={saving || mismatch} className={primaryButtonClass}>
          {saving ? "Saving..." : "Change password"}
        </button>
      </div>
    </form>
  );

  if (forced) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          <h1 className="text-xl font-bold text-gray-950">Set a new password</h1>
          <p className="text-[14px] text-gray-600 mt-1 mb-6">You signed in with a temporary password. Choose your own to continue.</p>
          {form}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="My account" />
      <Card className="p-5 mb-6">
        <dl className="grid sm:grid-cols-3 gap-4 text-[14px]">
          <div>
            <dt className="text-gray-600">Email</dt>
            <dd className="font-medium text-gray-950">{user?.email}</dd>
          </div>
          {MFA_ENABLED && (
            <div>
              <dt className="text-gray-600">Two-factor authentication</dt>
              <dd>{user?.mfaEnabled ? <Badge tone="green">On</Badge> : <Badge tone="amber">Off</Badge>}</dd>
            </div>
          )}
          <div>
            <dt className="text-gray-600">Last sign-in</dt>
            <dd className="text-gray-950">{formatDate(user?.lastLoginAt ?? null)}</dd>
          </div>
        </dl>
      </Card>
      <Card className="p-5">
        <h2 className="text-[15px] font-bold text-gray-950 mb-4">Change password</h2>
        {form}
      </Card>
    </>
  );
};
