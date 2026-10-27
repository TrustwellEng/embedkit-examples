import React, { useEffect, useState } from "react";
import { Integration, IntegrationStatus } from "../data/integrations";
import { apiFetch, exchangeCode, exchangeCodeFromUrl } from "../service/session";

interface LandingProps {
  onSelectIntegration: (integration: Integration) => void;
}

const base = import.meta.env.VITE_SERVER_URL as string;
const IS_DEV = import.meta.env.DEV;

type Status = "loading" | "ready" | "unauthorized" | "error";

// Display order: connected -> not connected -> disabled -> coming soon. Ties keep the server order.
const STATUS_RANK: Record<IntegrationStatus, number> = {
  connected: 0,
  not_connected: 1,
  disabled: 2,
  coming_soon: 3,
};

const sortIntegrations = (items: Integration[]) =>
  [...items].sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status]);

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
      setIntegrations(sortIntegrations(await res.json()));
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
        throw new Error(
          res.status === 403
            ? "Invalid Genesis ID or token."
            : res.status === 502
              ? "Unable to reach Genesis to validate the token."
              : "Login failed."
        );
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

  const standard = integrations.filter(isStandard);
  const premium = integrations.filter((item) => !isStandard(item));
  const standardUsed = standard.filter((item) => item.status === "connected").length;

  return (
    <div className="min-h-screen bg-white py-8 px-8">
      <div className="max-w-[1200px] mx-auto">
        <h1 className="text-xl font-bold text-black mb-6">Integrations</h1>

        {standard.length > 0 && (
          <IntegrationGroup
            title="Standard"
            subtitle={`Bundle of ${STANDARD_BUNDLE_SIZE}`}
            description={`One subscription covers up to ${STANDARD_BUNDLE_SIZE} standard integrations.`}
            usage={`${standardUsed} of ${STANDARD_BUNDLE_SIZE} used`}
            items={standard}
            onSelect={onSelectIntegration}
          />
        )}

        {premium.length > 0 && (
          <IntegrationGroup
            title="Premium"
            subtitle="Licensed individually"
            description="Each premium integration is purchased separately."
            items={premium}
            onSelect={onSelectIntegration}
          />
        )}
      </div>
    </div>
  );
};

// Group comes from the catalog badge (Standard / Premium); anything not Standard is Premium
const STANDARD_BUNDLE_SIZE = 3;
const isStandard = (item: Integration) => item.badge?.trim().toLowerCase() === "standard";

const IntegrationGroup: React.FC<{
  title: string;
  subtitle: string;
  description: string;
  usage?: string;
  items: Integration[];
  onSelect: (integration: Integration) => void;
}> = ({ title, subtitle, description, usage, items, onSelect }) => (
  <section className="mb-10" aria-label={`${title} integrations`}>
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="text-[14px] font-bold text-black">
        <span className="uppercase tracking-wide">{title}</span>
        <span className="font-normal text-gray-600"> · {subtitle}</span>
      </h2>
      {usage && <span className="text-[14px] text-gray-600 shrink-0">{usage}</span>}
    </div>
    <p className="text-[14px] text-gray-600 mt-1 mb-4">{description}</p>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {items.map((item) => (
        <IntegrationCard key={item.id} item={item} onSelect={() => onSelect(item)} />
      ))}
    </div>
  </section>
);
const cardBase =
  "group box-border h-full min-h-[220px] bg-white border border-[#E5E7EB] rounded-[12px] text-center transition-all duration-[120ms] ease-in-out flex flex-col items-center justify-center p-4 relative";
const cardInteractive =
  "cursor-pointer hover:border-2 hover:border-[#003F9C] hover:-m-[1px] focus-visible:border-2 focus-visible:border-[#003F9C] focus-visible:-m-[1px] focus-visible:outline-none";

const ConnectedStatus = () => (
  <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#15803D]">
    <span aria-hidden="true" className="w-2 h-2 rounded-full bg-[#16A34A]" />
    Connected
  </span>
);

const CardAction: React.FC<{ label: string }> = ({ label }) => (
  <span className="mt-1 text-[13px] font-semibold text-[#003F9C] group-hover:underline">
    {label} <span aria-hidden="true">→</span>
  </span>
);

const CardBody: React.FC<{ item: Integration; className: string; children?: React.ReactNode }> = ({
  item,
  className,
  children,
}) => (
  <div className={`flex flex-col items-center ${className}`}>
    <div className="w-12 h-12 flex items-center justify-center mb-3">
      <img src={item.iconUrl} alt="" className="max-h-full max-w-full object-contain" />
    </div>

    {/* Tier (Standard / Premium) is shown by the group header, not on the card */}
    <h3 className="m-0 text-[14px] font-bold text-[#000000] leading-normal">{item.name}</h3>

    {children}
  </div>
);

// Standard:  connected -> Connected; not connected -> Available (opens the wizard);
//            disabled -> Unavailable + Request (contact page)
// Premium:   connected -> Connected; not connected -> Licensed + Set up (wizard);
//            disabled (not enabled for the customer) -> Not licensed + Request (contact page)
// Coming soon: "Coming soon" ribbon, not clickable
const IntegrationCard: React.FC<{ item: Integration; onSelect: () => void }> = ({ item, onSelect }) => {
  const { status } = item;
  const standard = isStandard(item);

  if (status === "coming_soon") {
    return (
      <div role="group" aria-label={`${item.name}, coming soon`} className={`${cardBase} cursor-default`}>
        <div className="pointer-events-none absolute top-0 left-0 w-[110px] h-[110px] overflow-hidden rounded-tl-[12px]">
          <span className="absolute top-[22px] -left-[34px] w-[140px] -rotate-45 bg-[#F59E0B] text-white text-[11px] font-semibold uppercase tracking-wide text-center py-1 shadow-sm">
            Coming soon
          </span>
        </div>
        <CardBody item={item} className="opacity-60" />
      </div>
    );
  }

  let statusNode: React.ReactNode;
  let statusLabel: string;
  if (status === "connected") {
    statusNode = <ConnectedStatus />;
    statusLabel = "connected";
  } else if (standard) {
    // Connecting is done through the wizard (CustomerIntegration.isConfigured)
    statusNode =
      status === "not_connected" ? (
        <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-gray-600">
          <span aria-hidden="true" className="w-2 h-2 rounded-full border border-gray-500" />
          Available
        </span>
      ) : (
        <>
          <span className="mt-3 text-[13px] font-medium text-gray-600">Unavailable</span>
          <CardAction label="Request" />
        </>
      );
    statusLabel = status === "not_connected" ? "available" : "unavailable, request access";
  } else if (status === "not_connected") {
    statusNode = (
      <>
        <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-gray-600">
          <span aria-hidden="true" className="w-2 h-2 rounded-full border border-gray-500" />
          Licensed
        </span>
        <CardAction label="Set up" />
      </>
    );
    statusLabel = "licensed, set up";
  } else {
    statusNode = (
      <>
        <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-gray-600">
          <svg viewBox="0 0 16 16" className="w-3 h-3" aria-hidden="true">
            <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
            <path d="M5.5 7V5a2.5 2.5 0 015 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          Not licensed
        </span>
        <CardAction label="Request" />
      </>
    );
    statusLabel = "not licensed, request access";
  }

  const body = (
    <CardBody item={item} className="">
      {statusNode}
    </CardBody>
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`${item.name}, ${statusLabel}`}
      className={`${cardBase} ${cardInteractive}`}
    >
      {body}
    </button>
  );
};
