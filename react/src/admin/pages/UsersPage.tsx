import React, { useState } from "react";
import { AdminUser, MFA_ENABLED, usersApi } from "../api";
import { useAdminAuth } from "../AdminApp";
import {
  Badge,
  Card,
  ChangedBy,
  dangerButtonClass,
  ErrorText,
  Field,
  formatDate,
  inputClass,
  LoadState,
  Modal,
  PageHeader,
  primaryButtonClass,
  secondaryButtonClass,
  SecretBox,
  smallButtonClass,
  Td,
  Table,
  useAsync,
} from "../ui";

const isLocked = (u: AdminUser) => !!u.lockoutEnd && new Date(u.lockoutEnd) > new Date();

const UserStatus: React.FC<{ user: AdminUser }> = ({ user }) => {
  if (!user.isActive) return <Badge tone="gray">Inactive</Badge>;
  if (isLocked(user)) return <Badge tone="red">Locked</Badge>;
  if (user.mustChangePassword) return <Badge tone="amber">Pending first sign-in</Badge>;
  return <Badge tone="green">Active</Badge>;
};

const TempPasswordModal: React.FC<{ email: string; password: string; onClose: () => void }> = ({ email, password, onClose }) => (
  <Modal title="Temporary password" onClose={onClose}>
    <p className="text-[14px] text-gray-700 mb-3">
      Share this with <strong>{email}</strong> through a secure channel. It is shown only once, and they must change it at first sign-in.
    </p>
    <SecretBox value={password} />
    <div className="flex justify-end mt-6">
      <button type="button" onClick={onClose} className={primaryButtonClass}>
        Done
      </button>
    </div>
  </Modal>
);

const AddUserModal: React.FC<{ onClose: () => void; onCreated: (email: string, password: string) => void }> = ({ onClose, onCreated }) => {
  const [email, setEmail] = useState("");
  const [mfa, setMfa] = useState(MFA_ENABLED);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const { user, temporaryPassword } = await usersApi.create(email, mfa);
      onCreated(user.email, temporaryPassword);
    } catch (err: any) {
      setError(err?.message || "Failed to create user.");
      setSaving(false);
    }
  };

  return (
    <Modal title="Add admin user" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <Field label="Email" htmlFor="new-user-email" hint="A temporary password is generated. The user sets their own at first sign-in.">
          <input id="new-user-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        {MFA_ENABLED && (
          <label className="flex items-center gap-2 text-[14px] text-gray-800">
            <input type="checkbox" checked={mfa} onChange={(e) => setMfa(e.target.checked)} />
            Require two-factor authentication (TOTP)
          </label>
        )}
        <ErrorText error={error} />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={primaryButtonClass}>
            {saving ? "Creating..." : "Create user"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export const UsersPage: React.FC = () => {
  const { user: me } = useAdminAuth();
  const { data, loading, error, reload } = useAsync(() => usersApi.list());
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = async (u: AdminUser, action: () => Promise<unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(u.id);
    setActionError(null);
    try {
      await action();
      reload();
    } catch (err: any) {
      setActionError(err?.message || "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Admin users"
        description="People who can sign in to this console. Every signed-in user has full access."
        actions={
          <button type="button" onClick={() => setAdding(true)} className={primaryButtonClass}>
            + Add user
          </button>
        }
      />

      <Card>
        {actionError && <p className="px-4 pt-3 text-[13px] text-red-600">{actionError}</p>}
        <LoadState loading={loading && !data} error={error} empty={data?.length === 0} />
        {data && data.length > 0 && (
          <Table head={["Email", "Status", ...(MFA_ENABLED ? ["MFA"] : []), "Failed sign-ins", "Last sign-in", "Created", "Last changed", "Actions"]}>
            {data.map((u) => {
              const busy = busyId === u.id;
              const self = u.id === me?.id;
              return (
                <tr key={u.id}>
                  <Td className="font-medium text-gray-950">
                    {u.email}
                    {self && <span className="ml-2 text-[12px] text-gray-500">(you)</span>}
                  </Td>
                  <Td>
                    <UserStatus user={u} />
                  </Td>
                  {MFA_ENABLED && <Td>{u.mfaEnabled ? <Badge tone="green">On</Badge> : <Badge tone="amber">Off</Badge>}</Td>}
                  <Td>{u.failedLoginCount}</Td>
                  <Td className="whitespace-nowrap">{formatDate(u.lastLoginAt)}</Td>
                  <Td>
                    <ChangedBy at={u.createdAt} by={u.createdByEmail} />
                  </Td>
                  <Td>
                    <ChangedBy at={u.modifiedAt} by={u.modifiedByEmail} />
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      {isLocked(u) && (
                        <button type="button" disabled={busy} className={smallButtonClass} onClick={() => run(u, () => usersApi.unlock(u.id))}>
                          Unlock
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy || !u.isActive}
                        className={smallButtonClass}
                        onClick={() =>
                          run(
                            u,
                            async () => {
                              const { temporaryPassword } = await usersApi.resetPassword(u.id);
                              setSecret({ email: u.email, password: temporaryPassword });
                            },
                            `Reset the password for ${u.email}? Their current password stops working.`
                          )
                        }
                      >
                        Reset password
                      </button>
                      {MFA_ENABLED && u.mfaEnabled && (
                        <button
                          type="button"
                          disabled={busy}
                          className={smallButtonClass}
                          onClick={() => run(u, () => usersApi.resetMfa(u.id), `Reset MFA for ${u.email}? They will need to enroll again.`)}
                        >
                          Reset MFA
                        </button>
                      )}
                      {!self &&
                        (u.isActive ? (
                          <button
                            type="button"
                            disabled={busy}
                            className={dangerButtonClass}
                            onClick={() => run(u, () => usersApi.setActive(u.id, false), `Deactivate ${u.email}? They will be signed out.`)}
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button type="button" disabled={busy} className={smallButtonClass} onClick={() => run(u, () => usersApi.setActive(u.id, true))}>
                            Reactivate
                          </button>
                        ))}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      {adding && (
        <AddUserModal
          onClose={() => setAdding(false)}
          onCreated={(email, password) => {
            setAdding(false);
            setSecret({ email, password });
            reload();
          }}
        />
      )}
      {secret && <TempPasswordModal {...secret} onClose={() => setSecret(null)} />}
    </>
  );
};
