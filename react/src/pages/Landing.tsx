import React, { useEffect, useState } from "react";
import { Integration } from "../data/integrations";
import { apiFetch, exchangeCode, exchangeCodeFromUrl } from "../service/session";

interface LandingProps {
  onSelectIntegration: (integration: Integration) => void;
}

const base = import.meta.env.VITE_SERVER_URL as string;
const IS_DEV = import.meta.env.DEV;

type Status = "loading" | "ready" | "unauthorized" | "error";

const inputClass =
  "box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors";

export const Landing: React.FC<LandingProps> = ({ onSelectIntegration }) => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  // Local dev only (when there is no Genesis host to embed the iframe)
  const [inputGenesisId, setInputGenesisId] = useState("");
  const [inputApiToken, setInputApiToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const loadIntegrations = async (signal?: AbortSignal) => {
    setStatus("loading");
    try {
      // Iframe/web opened with ?code=... -> exchange the code for a session first
      await exchangeCodeFromUrl();

      const res = await apiFetch("/api/integrations", { signal });
      if (res.status === 401) {
        setStatus("unauthorized");
        return;
      }
      if (!res.ok) throw new Error("Unable to fetch integrations list from server.");
      setIntegrations(await res.json());
      setStatus("ready");
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      setError(err?.message || "An error occurred.");
      setStatus("error");
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadIntegrations(controller.signal);
    return () => controller.abort();
  }, []);

  // DEV ONLY: simulate the Genesis backend requesting a code, then exchange it like the iframe would
  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputGenesisId.trim() || !inputApiToken.trim()) return;
    setSubmitting(true);
    setLoginError(null);
    try {
      const res = await fetch(`${base}/api/code`, {
        method: "POST",
        headers: {
          "x-genesis-customer-id": inputGenesisId.trim(),
          "x-genesis-auth-token": inputApiToken.trim(),
        },
      });
      if (!res.ok) {
        throw new Error(res.status === 403 ? "Invalid Genesis ID or token." : "Login failed.");
      }
      const { code } = await res.json();
      await exchangeCode(code);
      setSubmitting(false);
      await loadIntegrations();
    } catch (err: any) {
      setLoginError(err?.message || "Login failed.");
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white py-8 px-8 flex items-center justify-center">
        <p className="text-gray-500 font-medium">Loading...</p>
      </div>
    );
  }

  if (status === "unauthorized") {
    // Production: no form; the user must open this from Genesis (iframe gets a fresh code)
    if (!IS_DEV) {
      return (
        <div className="min-h-screen bg-white py-8 px-8 flex flex-col items-center justify-center text-center">
          <h1 className="text-xl font-bold text-gray-950 mb-2">Session expired</h1>
          <p className="text-gray-500 mb-4">
            Please reload this page from Genesis to continue.
          </p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-2xl w-full">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
            <div className="border-b border-gray-200 pb-6 mb-6">
              <h1 className="text-xl font-bold text-gray-950 mb-1">Genesis Authentication (dev only)</h1>
              <p className="text-sm text-gray-500">
                In production, Genesis opens this page with a one-time code. This form only simulates that.
              </p>
            </div>
            <form onSubmit={handleDevLogin} className="space-y-6">
              <div className="flex flex-col">
                <label className="block text-[14px] font-semibold text-black mb-1">GENESIS ID</label>
                <input
                  type="text"
                  value={inputGenesisId}
                  onChange={(e) => setInputGenesisId(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-[14px] font-semibold text-black mb-1">API TOKEN</label>
                <input
                  type="password"
                  value={inputApiToken}
                  onChange={(e) => setInputApiToken(e.target.value)}
                  className={`${inputClass} font-mono`}
                  required
                />
              </div>
              {loginError && <p className="text-sm text-red-500">{loginError}</p>}
              <div className="pt-6 flex items-center justify-end space-x-4 border-t border-gray-200 mt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 text-[14px] font-medium text-white bg-[#4F46E5] rounded-[6px] hover:bg-[#4338CA] disabled:opacity-60 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] transition-colors shadow-sm"
                >
                  {submitting ? "Signing in..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-white py-8 px-8 flex flex-col items-center justify-center">
        <p className="text-red-500 font-medium mb-4">Error: {error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-8 px-8">
      <div className="max-w-[1200px] mx-auto">
        <h1 className="text-xl font-bold text-black mb-6">Integrations</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {integrations.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectIntegration(item)}
              className="box-border bg-white border border-[#E5E7EB] rounded-[12px] text-center cursor-pointer transition-all duration-[120ms] ease-in-out flex flex-col items-center justify-center aspect-square p-4 hover:border-2 hover:border-[#003F9C] hover:-m-[1px] focus-visible:border-2 focus-visible:border-[#003F9C] focus-visible:-m-[1px] focus-visible:outline-none relative"
            >
              {item.isConfigured && (
                <span
                  className="absolute top-2 right-2 w-2.5 h-2.5 bg-green-500 rounded-full"
                  title="Configured"
                />
              )}

              <div className="w-12 h-12 flex items-center justify-center mb-3">
                <img src={item.iconUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
              </div>

              <h3 className="m-0 text-[14px] font-bold text-[#000000] leading-normal mb-2">{item.name}</h3>

              <span className="inline-flex items-center justify-center h-[24px] px-[12px] rounded-[40px] bg-[#F1F5F9] text-[14px] font-normal text-[#000000] leading-normal">
                {item.badge || item.category || "Data"}
              </span>
            </button>
          ))}

          {[...Array(Math.max(0, 8 - integrations.length))].map((_, emptyBox) => (
            <div
              key={`empty-${emptyBox}`}
              className="box-border bg-white border border-[#E5E7EB] rounded-[12px] aspect-square"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
