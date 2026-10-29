import React, { useState, useEffect } from "react";
import { apiFetch } from "../service/session";
import { DataSyncConfig, Integration, IntegrationConfigure, NetsuiteConfigure, OracleConfigure, SapConfigure, ScheduleConfig, SlackConfigure } from "../data/integrations";
import { Stepper } from "./wizard/Stepper";
import {
  CompleteStep,
  DataSyncStep,
  DEFAULT_DATA_SYNC,
  defaultSchedule,
  DeliveryStep,
  isSlackIntegration,
  ScheduleStep,
  WelcomeStep,
} from "./wizard/steps";
import { Field, inputClass, StepFooter } from "./wizard/ui";

interface DetailProps {
  integration: Integration;
  onBack: () => void;
}

type SlackFieldErrors = { accessToken?: string };

const SlackDetails = ({
  formData,
  handleChange,
  errors,
}: {
  formData: SlackConfigure;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  errors: SlackFieldErrors;
}) => (
  <>
    <Field label="Client ID" htmlFor="clientId" hint="Found under Basic Information → App Credentials in your Slack app settings">
      <input id="clientId" type="text" name="clientId" value={formData.clientId || ""} onChange={handleChange} className={inputClass} />
    </Field>
    <Field
      label="Client Secret"
      htmlFor="clientSerect"
      hint="Found under Basic Information → App Credentials. It's encrypted and stored securely."
    >
      <input id="clientSerect" type="password" name="clientSerect" value={formData.clientSerect || ""} onChange={handleChange} className={`${inputClass} font-mono`} />
    </Field>
    <Field
      label="Bot Access Token"
      htmlFor="accessToken"
      hint={'Found under OAuth & Permissions. Starts with "xoxb-". It\'s encrypted and stored securely.'}
      error={errors.accessToken}
    >
      <input
        id="accessToken"
        type="password"
        name="accessToken"
        value={formData.accessToken || ""}
        onChange={handleChange}
        aria-invalid={!!errors.accessToken}
        className={`${inputClass} font-mono`}
      />
    </Field>
  </>
);
const DefaultDetails = ({ formData, handleChange }: { formData: OracleConfigure; handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
  <>
    <Field label="API URL" htmlFor="apiUrl" hint="The base URL of your Oracle PLM Cloud instance (e.g., https://yourcompany.oraclecloud.com)">
      <input id="apiUrl" type="url" name="apiUrl" value={formData.apiUrl || ""} onChange={handleChange} className={inputClass} />
    </Field>
    <Field label="Account ID" htmlFor="apiAccountId" hint="Your Oracle PLM Cloud account identifier">
      <input id="apiAccountId" type="text" name="apiAccountId" value={formData.apiAccountId || ""} onChange={handleChange} className={inputClass} />
    </Field>
    <Field label="Username" htmlFor="apiUsername" hint="The integration user's username. We recommend a dedicated service account.">
      <input id="apiUsername" type="text" name="apiUsername" value={formData.apiUsername || ""} onChange={handleChange} className={inputClass} />
    </Field>
    <Field label="API token" htmlFor="apiToken" hint="The API token for this user. It's encrypted and stored securely.">
      <input id="apiToken" type="password" name="apiToken" value={formData.apiToken || ""} onChange={handleChange} className={`${inputClass} font-mono`} />
    </Field>
  </>
);
const SapDetails = ({ formData, handleChange }: { formData: SapConfigure; handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
  <>
    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">ODATA Service URL</label>
      <input
        type="text"
        name="odataUrl"
        value={formData.odataUrl || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      />
    </div>
    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Username</label>
      <input
        type="text"
        name="userName"
        value={formData.userName || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      />
    </div>
    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Password / Token</label>
      <input
        type="password"
        name="password"
        value={formData.password || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] font-mono leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      />
    </div>
    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Client Number</label>
      <input
        type="text"
        name="clientNumber"
        value={formData.clientNumber || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      />
    </div>
  </>
);
const NetsuiteDetails = ({ formData, handleChange }: { formData: NetsuiteConfigure; handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void }) => (
  <>
    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">URL</label>
      <input
        type="text"
        name="url"
        value={formData.url || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      />
    </div>

    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">User</label>
      <input
        type="text"
        name="user"
        value={formData.user || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      />
    </div>

    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Password</label>
      <input
        type="password"
        name="password"
        value={formData.password || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] font-mono leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      />
    </div>

    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Account Number</label>
      <input
        type="text"
        name="accountNumber"
        value={formData.accountNumber || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      />
    </div>

    <div className="flex items-center space-x-2 my-2">
      <input
        type="checkbox"
        name="useBoomiRecord"
        checked={formData.useBoomiRecord || false}
        onChange={(e: any) => handleChange({ target: { name: 'useBoomiRecord', value: e.target.checked } } as any)}
        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
      />
      <label className="text-[14px] font-semibold text-black">Use Boomi Integration Record</label>
    </div>

    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Consumer Key</label>
      <input
        type="text"
        name="consumerKey"
        value={formData.consumerKey || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      />
    </div>

    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Consumer Secret</label>
      <input
        type="password"
        name="consumerSecret"
        value={formData.consumerSecret || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] font-mono leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      />
    </div>

    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Consumer Secret (Deprecated)</label>
      <input
        type="password"
        name="consumerSecretDeprecated"
        value={formData.consumerSecretDeprecated || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] font-mono leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      />
    </div>

    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Token Id</label>
      <input
        type="text"
        name="tokenId"
        value={formData.tokenId || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      />
    </div>

    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Token Secret</label>
      <input
        type="password"
        name="tokenSecret"
        value={formData.tokenSecret || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] font-mono leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      />
    </div>

    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Token Secret (Deprecated)</label>
      <input
        type="password"
        name="tokenSecretDeprecated"
        value={formData.tokenSecretDeprecated || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] font-mono leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      />
    </div>

    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Application Id</label>
      <input
        type="text"
        name="applicationId"
        value={formData.applicationId || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      />
    </div>

    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Version</label>
      <select
        name="version"
        value={formData.version || "Version 2025.2"}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      >
        <option value="Version 2025.2">Version 2025.2</option>
        <option value="Version 2025.1">Version 2025.1</option>
        <option value="Version 2024.2">Version 2024.2</option>
      </select>
    </div>

    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Number of Retries</label>
      <select
        name="numberofRetries"
        value={formData.numberofRetries || "5"}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      >
        <option value="3">3</option>
        <option value="5">5</option>
        <option value="10">10</option>
      </select>
    </div>

    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Maximum Number of Concurrent Connections</label>
      <input
        type="number"
        name="maxConcurrentConnections"
        value={formData.maxConcurrentConnections || "1"}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
      />
    </div>
  </>
);

const STEPS = ["Welcome", "Connection", "Data sync", "Schedule", "Complete"];
// Slack sends events in real time, so step 4 sets up delivery instead of a schedule
const SLACK_STEPS = ["Welcome", "Connection", "Data sync", "Delivery", "Complete"];
// Temporarily off: Slack connection step saves without checking the token/channel or calling auth.test.
// Set to true to turn the checks back on.
const SLACK_CONNECTION_TEST_ENABLED = false;
const SLACK_CONNECTION_ERROR = "We couldn't connect to Slack. Check your credentials and confirm the app is installed in your workspace.";
const STEP = { welcome: 0, connection: 1, dataSync: 2, schedule: 3, complete: 4 } as const;

// Load a saved JSON payload (configPayload) from one of the wizard endpoints; null if none saved
async function loadPayload<T>(path: string): Promise<T | null> {
  const res = await apiFetch(path);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.configPayload) return null;
  try {
    return JSON.parse(data.configPayload) as T;
  } catch {
    return null;
  }
}

async function savePayload(path: string, body: unknown) {
  const res = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to save. Please try again.");
}

function defaultConnection(integration: Integration): IntegrationConfigure {
  const id = integration.id;
  if (isSlackIntegration(id)) {
    return { id, clientId: "", clientSerect: "", accessToken: "", channelName: "" } as SlackConfigure;
  }
  if (id === "netsuite") {
    return { id, accountId: "", consumerKey: "", consumerSecret: "", tokenId: "" } as NetsuiteConfigure;
  }
  if (id === "sap_s4hana") {
    return { id, odataUrl: "", userName: "", password: "", clientNumber: "" } as SapConfigure;
  }
  return { id, apiUrl: "", apiAccountId: "", apiUsername: "", apiToken: "" } as OracleConfigure;
}

type FormStep = "connection" | "dataSync" | "schedule";
const FORM_STEP_BY_INDEX: Record<number, FormStep | undefined> = {
  [STEP.connection]: "connection",
  [STEP.dataSync]: "dataSync",
  [STEP.schedule]: "schedule",
};
const NONE = { connection: false, dataSync: false, schedule: false };

export const Detail: React.FC<DetailProps> = ({ integration, onBack }) => {
  const [formData, setFormData] = useState<IntegrationConfigure>(() => defaultConnection(integration));
  const [dataSync, setDataSync] = useState<DataSyncConfig>(DEFAULT_DATA_SYNC);
  const [schedule, setSchedule] = useState<ScheduleConfig>(defaultSchedule);

  const [step, setStep] = useState<number>(STEP.welcome);
  // saved: step has a row in the DB. dirty: edited since last save.
  const [saved, setSaved] = useState<Record<FormStep, boolean>>(NONE);
  const [dirty, setDirty] = useState<Record<FormStep, boolean>>(NONE);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slackErrors, setSlackErrors] = useState<SlackFieldErrors>({});

  const isSlack = isSlackIntegration(integration.id);
  const isSap = integration.id === "sap_s4hana";
  const isNetsuite = integration.id === "netsuite";
  const isOracle = integration.id === "oracle";

  const stepPaths: Record<FormStep, string> = {
    connection: `/api/credentials/${integration.id}`,
    dataSync: `/api/data-sync/${integration.id}`,
    schedule: `/api/schedule/${integration.id}`,
  };
  const stepValues: Record<FormStep, unknown> = { connection: formData, dataSync, schedule };

  // Load all saved steps; returning users land on the first step not saved yet
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const [connection, sync, sched] = await Promise.all([
          loadPayload<IntegrationConfigure>(`/api/credentials/${integration.id}`),
          loadPayload<DataSyncConfig>(`/api/data-sync/${integration.id}`),
          loadPayload<ScheduleConfig>(`/api/schedule/${integration.id}`),
        ]);
        if (cancelled) return;

        if (connection) setFormData(connection);
        if (sync) setDataSync({ ...DEFAULT_DATA_SYNC, ...sync });
        if (sched) setSchedule({ ...defaultSchedule(), ...sched });
        setSaved({ connection: !!connection, dataSync: !!sync, schedule: !!sched });
        setDirty(NONE);

        if (!connection && !sync && !sched) setStep(STEP.welcome);
        else if (!connection) setStep(STEP.connection);
        else if (!sync) setStep(STEP.dataSync);
        else if (!sched) setStep(STEP.schedule);
        else setStep(STEP.complete);
      } catch (err) {
        console.error("Failed to load integration settings", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [integration.id]);

  // Save a form step. `force` saves even without edits (explicit "Save & continue").
  const persist = async (key: FormStep, force: boolean, value: unknown = stepValues[key]) => {
    if (!force && !dirty[key]) return true;
    setSaving(true);
    setError(null);
    try {
      await savePayload(stepPaths[key], value);
      setSaved((v) => ({ ...v, [key]: true }));
      setDirty((v) => ({ ...v, [key]: false }));
      return true;
    } catch (err: any) {
      setError(err?.message || "Failed to save.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Move to any step; unsaved edits on the current step are saved first
  const goTo = async (next: number) => {
    if (next === step || saving) return;
    const current = FORM_STEP_BY_INDEX[step];
    if (current && !(await persist(current, false))) return;
    setError(null);
    setStep(next);
  };

  const saveAndContinue = async (key: FormStep, next: number, value?: unknown) => {
    if (await persist(key, true, value ?? stepValues[key])) setStep(next);
  };

  const markDirty = (key: FormStep) => {
    setDirty((v) => (v[key] ? v : { ...v, [key]: true }));
    setError(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as any;
    const name = target.name;
    const value = target.type === "checkbox" ? target.checked : target.value;

    setFormData((prev: any) => ({
      ...prev,
      [name]: value,
    }));
    markDirty("connection");
    if (name in slackErrors) setSlackErrors((v) => ({ ...v, [name]: undefined }));
  };

  // Slack: check the fields, then confirm the token works and remember the workspace name
  const testSlackConnection = async (): Promise<SlackConfigure | null> => {
    const slack = formData as SlackConfigure;
    const errors: SlackFieldErrors = {};
    if (!slack.accessToken?.trim().startsWith("xoxb-")) errors.accessToken = "Enter a valid bot token (starts with xoxb-).";
    setSlackErrors(errors);
    if (errors.accessToken) return null;

    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/slack/${integration.id}/test-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: slack.accessToken!.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error();
      const next = { ...slack, accessToken: slack.accessToken!.trim(), workspaceName: data.workspaceName };
      setFormData(next);
      return next;
    } catch {
      setError(SLACK_CONNECTION_ERROR);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleConnectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSlack || !SLACK_CONNECTION_TEST_ENABLED) return saveAndContinue("connection", STEP.dataSync);
    const tested = await testSlackConnection();
    if (tested) saveAndContinue("connection", STEP.dataSync, tested);
  };

  // Slack delivery: the channel lives on the connection, so save it before the delivery settings
  const handleDeliverySubmit = async () => {
    if (!(await persist("connection", false))) return;
    saveAndContinue("schedule", STEP.complete);
  };

  const sendSlackTestMessage = async (): Promise<string | null> => {
    if (!(await persist("connection", false))) return "Couldn't save the channel. Please try again.";
    try {
      const res = await apiFetch(`/api/slack/${integration.id}/test-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: (formData as SlackConfigure).channelName }),
      });
      if (res.ok) return null;
      const data = await res.json().catch(() => null);
      if (data?.error === "channel_not_found" || data?.error === "not_in_channel") {
        return "Trustwell can't post to this channel. Check the name, and for private channels invite your Slack app first.";
      }
      return SLACK_CONNECTION_ERROR;
    } catch {
      return SLACK_CONNECTION_ERROR;
    }
  };

  // Welcome is only an introduction: show no progress there, even if later steps were saved before
  const onWelcome = step === STEP.welcome;
  const completed = [
    !onWelcome,
    !onWelcome && saved.connection,
    !onWelcome && saved.dataSync,
    !onWelcome && saved.schedule,
    !onWelcome && saved.connection && saved.dataSync && saved.schedule,
  ];

  const renderStep = () => {
    switch (step) {
      case STEP.welcome:
        return <WelcomeStep integration={integration} onStart={() => goTo(STEP.connection)} onCancel={onBack} />;

      case STEP.connection:
        return (
          <form onSubmit={handleConnectionSubmit} className="space-y-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-950">Connection</h2>
              <p className="text-sm text-gray-600 mt-1">
                {isSlack
                  ? "Enter your Slack app credentials. You can find these in your Slack app settings at api.slack.com/apps. You choose the channel in the Delivery step."
                  : `Enter the API credentials for your ${integration.name} account. Your ${isOracle ? "Oracle" : integration.name} administrator can provide these.`}
              </p>
            </div>
            {isSlack ? (
              <SlackDetails formData={formData} handleChange={handleChange} errors={slackErrors} />
            ) : isSap ? (
              <SapDetails formData={formData} handleChange={handleChange} />
            ) : isNetsuite ? (
              <NetsuiteDetails formData={formData} handleChange={handleChange} />
            ) : (
              <DefaultDetails formData={formData} handleChange={handleChange} />
            )}
            <StepFooter
              onBack={() => goTo(STEP.welcome)}
              submitLabel={isOracle || (isSlack && SLACK_CONNECTION_TEST_ENABLED) ? "Test & continue" : "Save & continue"}
              saving={saving}
              error={error}
            />
          </form>
        );

      case STEP.dataSync:
        return (
          <DataSyncStep
            integration={integration}
            value={dataSync}
            onChange={(v) => {
              setDataSync(v);
              markDirty("dataSync");
            }}
            onBack={() => goTo(STEP.connection)}
            onSubmit={() => saveAndContinue("dataSync", STEP.schedule)}
            saving={saving}
            error={error}
          />
        );

      case STEP.schedule:
        if (isSlack) {
          return (
            <DeliveryStep
              value={schedule}
              onChange={(v) => {
                setSchedule(v);
                markDirty("schedule");
              }}
              channel={(formData as SlackConfigure).channelName || ""}
              onChannelChange={(channelName) => {
                setFormData((prev) => ({ ...prev, channelName }));
                markDirty("connection");
              }}
              onSendTest={sendSlackTestMessage}
              onBack={() => goTo(STEP.dataSync)}
              onSubmit={handleDeliverySubmit}
              saving={saving}
              error={error}
            />
          );
        }
        return (
          <ScheduleStep
            value={schedule}
            onChange={(v) => {
              setSchedule(v);
              markDirty("schedule");
            }}
            onBack={() => goTo(STEP.dataSync)}
            onSubmit={() => saveAndContinue("schedule", STEP.complete)}
            saving={saving}
            error={error}
          />
        );

      default:
        return (
          <CompleteStep
            integration={integration}
            connection={formData}
            dataSync={dataSync}
            schedule={schedule}
            saved={saved}
            onEdit={goTo}
            onDone={onBack}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={onBack}
          className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-indigo-600 mb-6 transition-colors"
        >
          <span className="mr-2">←</span> Back to Integrations
        </button>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sm:p-8">
          <div className="flex items-center space-x-4 border-b border-gray-200 pb-6 mb-6">
            <img src={integration.iconUrl} alt={integration.name} className="w-12 h-12 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-gray-950">{integration.name} Setup</h1>
              <p className="text-sm text-gray-600">{integration.badge || integration.category}</p>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-gray-600 text-sm">Loading configuration...</div>
          ) : (
            <>
              <Stepper steps={isSlack ? SLACK_STEPS : STEPS} current={step} completed={completed} disabled={saving} onSelect={goTo} />
              {renderStep()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
