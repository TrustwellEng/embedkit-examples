import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../api";
import { useAdminAuth } from "../AdminApp";
import { ErrorText, Field, inputClass, primaryButtonClass, secondaryButtonClass } from "../ui";

// Step 1: email + password. Step 2 (only when the user has MFA): 6-digit TOTP code.
export const LoginPage: React.FC = () => {
  const { refresh } = useAdminAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"password" | "mfa">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = async () => {
    await refresh();
    navigate("/admin", { replace: true });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (step === "password") {
        const res = await auth.login(email, password);
        if (res.mfaRequired) {
          setStep("mfa");
          setPassword("");
        } else await done();
      } else {
        await auth.verifyMfa(code);
        await done();
      }
    } catch (err: any) {
      setError(err?.message || "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
        <h1 className="text-xl font-bold text-gray-950">Trustwell Admin</h1>
        <p className="text-[14px] text-gray-600 mt-1 mb-6">
          {step === "password" ? "Sign in to manage integrations." : "Enter the 6-digit code from your authenticator app."}
        </p>

        <form onSubmit={submit} className="space-y-5">
          {step === "password" ? (
            <>
              <Field label="Email" htmlFor="admin-email">
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Password" htmlFor="admin-password">
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </>
          ) : (
            <Field label="Verification code" htmlFor="admin-mfa">
              <input
                id="admin-mfa"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className={`${inputClass} font-mono tracking-[0.3em]`}
              />
            </Field>
          )}

          <ErrorText error={error} />

          <div className="flex gap-3">
            {step === "mfa" && (
              <button
                type="button"
                className={secondaryButtonClass}
                onClick={() => {
                  setStep("password");
                  setCode("");
                  setError(null);
                }}
              >
                Back
              </button>
            )}
            <button type="submit" disabled={busy} className={`${primaryButtonClass} flex-1`}>
              {busy ? "Signing in..." : step === "password" ? "Sign in" : "Verify"}
            </button>
          </div>
        </form>

        {import.meta.env.DEV && (
          <p className="mt-6 text-[12px] text-gray-500 border-t border-gray-100 pt-4">
            First admin is created by server/prisma/sql/2026-10-28_admin_console.sql.
          </p>
        )}
      </div>
    </div>
  );
};
