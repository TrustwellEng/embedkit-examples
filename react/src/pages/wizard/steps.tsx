import React from "react";
import { DataSyncConfig, Integration, IntegrationConfigure, ScheduleConfig, SlackConfigure } from "../../data/integrations";
import { Field, inputClass, primaryButtonClass, secondaryButtonClass, StepFooter } from "./ui";

/* ------------ options ------------ */
export const FREQUENCIES: { value: ScheduleConfig["frequency"]; label: string }[] = [
  { value: "every_15_minutes", label: "Every 15 minutes" },
  { value: "hourly", label: "Every hour" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
];

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export const isSlackIntegration = (id: string) => id === "slack_integration" || id === "stack_integration";

// Channel names like "#trustwell-alerts" or "trustwell-alerts"
export const SLACK_CHANNEL_ERROR = "Enter a channel name, like #trustwell-alerts.";
export const isValidSlackChannel = (channel: string | undefined) => /^#?[a-z0-9][a-z0-9._-]*$/i.test((channel ?? "").trim());

// What each integration can sync in the Data sync step (integrations not listed keep the placeholder)
interface SyncOptions {
  direction: DataSyncConfig["syncDirection"];
  flow: string;
  description: string;
  required: string;
  note?: string;
  options: { value: string; label: string; description: string }[];
}

const SLACK_SYNC: SyncOptions = {
  direction: "genesis_to_app",
  flow: "Trustwell → Slack",
  description: "Choose which Trustwell events to send to Slack. Select at least one.",
  required: "Select at least one event to continue.",
  options: [
    { value: "ingredients", label: "Ingredient Updates", description: "Posts a message when an ingredient is added or updated." },
    { value: "recipes", label: "Recipe Updates", description: "Posts a message when a recipe is added or updated." },
  ],
};

export const SYNC_OPTIONS: Record<string, SyncOptions> = {
  oracle: {
    direction: "app_to_genesis",
    flow: "Oracle → Trustwell",
    description: "Choose which records to import from Oracle PLM Cloud into Trustwell. Select at least one.",
    required: "Select at least one record type to continue.",
    note: "Recipes reference ingredients. For best results, enable Ingredient Import too.",
    options: [
      {
        value: "ingredients",
        label: "Ingredient Import",
        description:
          "Imports approved ingredient specifications from Oracle as ingredients in Trustwell, including nutrients, allergens, and ingredient statements.",
      },
      {
        value: "recipes",
        label: "Recipe Import",
        description: "Imports approved formula specifications from Oracle as recipes in Trustwell, including their ingredient lists (BOM).",
      },
    ],
  },
  slack_integration: SLACK_SYNC,
  stack_integration: SLACK_SYNC,
};

export const DEFAULT_DATA_SYNC: DataSyncConfig = {
  syncDirection: "app_to_genesis",
  objects: [],
  syncMode: "incremental",
  conflictResolution: "genesis_wins",
};

export const defaultSchedule = (): ScheduleConfig => ({
  enabled: true,
  frequency: "daily",
  time: "02:00",
  dayOfWeek: "monday",
  timezone: browserTimezone(),
  notifyOnFailure: true,
  notificationEmail: "",
});

const TIMEZONES = Array.from(new Set([browserTimezone(), "UTC", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Asia/Ho_Chi_Minh", "Asia/Singapore"]));

/* ------------ shared step props ------------ */
interface StepProps<T> {
  value: T;
  onChange: (next: T) => void;
  onBack: () => void;
  onSubmit: () => void;
  saving: boolean;
  error: string | null;
}

const StepHeading: React.FC<{ title: string; description: string }> = ({ title, description }) => (
  <div className="mb-6">
    <h2 className="text-lg font-bold text-gray-950">{title}</h2>
    <p className="text-sm text-gray-600 mt-1">{description}</p>
  </div>
);

const submitHandler = (onSubmit: () => void) => (e: React.FormEvent) => {
  e.preventDefault();
  onSubmit();
};

/* ------------ 1. Welcome ------------ */
function welcomeCopy(integration: Integration) {
  if (isSlackIntegration(integration.id)) {
    return {
      body: "Get real-time Trustwell notifications in your Slack workspace. Enter your Slack app credentials, choose which events to send, and pick the channel where they're posted. This takes about 3 minutes.",
      steps: [
        { title: "Connection", text: "Enter your Slack app's Client ID, Client Secret and Bot Token" },
        { title: "Data sync", text: "Choose which events to send to Slack" },
        { title: "Delivery", text: "Choose the channel and confirm real-time delivery" },
      ],
    };
  }
  return {
    body: `Set up a connection to your ${integration.name} account, choose which records to import, and set a sync schedule. This takes about 5 minutes.`,
    steps: [
      { title: "Connection", text: `Enter your ${integration.name} API credentials` },
      { title: "Data sync", text: `Choose which records to import from ${integration.name} into Trustwell` },
      { title: "Schedule", text: "Set how often the sync runs" },
    ],
  };
}

export const WelcomeStep: React.FC<{ integration: Integration; onStart: () => void; onCancel: () => void }> = ({
  integration,
  onStart,
  onCancel,
}) => {
  const copy = welcomeCopy(integration);
  return (
    <div className="text-center py-4">
      <img src={integration.iconUrl} alt="" className="w-16 h-16 object-contain mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-950 mb-2">Connect {integration.name} to Trustwell</h2>
      <p className="text-sm text-gray-600 max-w-md mx-auto mb-8">{copy.body}</p>

      <ol className="text-left max-w-sm mx-auto space-y-4 mb-8">
        {copy.steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#E0E7FF] text-[#4338CA] text-[12px] font-semibold shrink-0">
              {i + 1}
            </span>
            <div>
              <p className="text-[14px] font-semibold text-gray-950">{s.title}</p>
              <p className="text-[13px] text-gray-600">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="flex justify-center gap-4">
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          Cancel
        </button>
        <button type="button" onClick={onStart} className={primaryButtonClass}>
          Get started
        </button>
      </div>
    </div>
  );
};

/* ------------ 3. Data sync ------------ */
export const DataSyncStep: React.FC<StepProps<DataSyncConfig> & { integration: Integration }> = ({
  integration,
  value,
  onChange,
  onBack,
  onSubmit,
  saving,
  error,
}) => {
  const sync = SYNC_OPTIONS[integration.id];
  const [showRequired, setShowRequired] = React.useState(false);

  const toggle = (option: string, checked: boolean) => {
    const objects = checked ? [...value.objects, option] : value.objects.filter((o) => o !== option);
    onChange({ ...value, syncDirection: sync.direction, objects });
    if (objects.length) setShowRequired(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sync && !sync.options.some((o) => value.objects.includes(o.value))) {
      setShowRequired(true);
      return;
    }
    onSubmit();
  };

  // Integrations without import options yet keep the placeholder
  if (!sync) {
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <StepHeading title="Data sync" description="Choose what data moves between Trustwell and this integration." />

        <div className="flex flex-col items-center justify-center text-center min-h-[240px] px-6 py-10 rounded-[8px] border-2 border-dashed border-gray-300 bg-gray-50">
          <p className="text-[14px] font-semibold text-gray-950">Data sync settings are coming soon</p>
          <p className="mt-1 text-[13px] text-gray-600 max-w-sm">
            You'll be able to pick which records to sync and in which direction here. Continue to set up the schedule.
          </p>
        </div>

        <StepFooter onBack={onBack} submitLabel="Continue" saving={saving} error={error} />
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <StepHeading title="Data sync" description={sync.description} />

      <fieldset className="space-y-3">
        <legend className="sr-only">Data to sync</legend>
        {sync.options.map((o) => (
          <label
            key={o.value}
            className={`flex items-start gap-3 p-4 rounded-[8px] border cursor-pointer transition-colors ${
              value.objects.includes(o.value) ? "border-[#4F46E5] bg-[#EEF2FF]" : "border-gray-300 hover:border-gray-500"
            }`}
          >
            <input
              type="checkbox"
              checked={value.objects.includes(o.value)}
              onChange={(e) => toggle(o.value, e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#4F46E5] shrink-0"
            />
            <span>
              <span className="block text-[14px] font-semibold text-gray-950">
                {o.label} <span className="font-normal text-gray-600">({sync.flow})</span>
              </span>
              <span className="block mt-0.5 text-[13px] text-gray-600">{o.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {sync.note && (
        <p className="flex gap-2 px-4 py-3 rounded-[8px] bg-[#EFF6FF] text-[13px] text-[#1E3A8A]">
          <span aria-hidden="true">ℹ️</span>
          {sync.note}
        </p>
      )}

      <StepFooter
        onBack={onBack}
        submitLabel="Continue"
        saving={saving}
        error={showRequired ? sync.required : error}
      />
    </form>
  );
};

/* ------------ 4. Schedule ------------ */
export const ScheduleStep: React.FC<StepProps<ScheduleConfig>> = ({ value, onChange, onBack, onSubmit, saving, error }) => {
  const set = <K extends keyof ScheduleConfig>(key: K, v: ScheduleConfig[K]) => onChange({ ...value, [key]: v });
  const needsTime = value.frequency === "daily" || value.frequency === "weekly";

  return (
    <form onSubmit={submitHandler(onSubmit)} className="space-y-6">
      <StepHeading title="Schedule" description="Choose when the sync runs automatically." />

      <label className="flex items-center justify-between gap-4 p-4 rounded-[8px] border border-gray-300 cursor-pointer">
        <span>
          <span className="block text-[14px] font-semibold text-gray-950">Run automatically</span>
          <span className="block text-[13px] text-gray-600">Sync on a set schedule. Turn this off to sync only when you start it manually.</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={value.enabled}
          onChange={(e) => set("enabled", e.target.checked)}
          className="w-5 h-5 accent-[#4F46E5] shrink-0"
        />
      </label>

      {value.enabled && (
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Frequency" htmlFor="frequency">
            <select
              id="frequency"
              value={value.frequency}
              onChange={(e) => set("frequency", e.target.value as ScheduleConfig["frequency"])}
              className={inputClass}
            >
              {FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>

          {value.frequency === "weekly" && (
            <Field label="Day" htmlFor="dayOfWeek">
              <select id="dayOfWeek" value={value.dayOfWeek} onChange={(e) => set("dayOfWeek", e.target.value)} className={inputClass}>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {capitalize(d)}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {needsTime && (
            <Field label="Time" htmlFor="time">
              <input id="time" type="time" value={value.time} onChange={(e) => set("time", e.target.value)} className={inputClass} />
            </Field>
          )}

          <Field label="Time zone" htmlFor="timezone">
            <select id="timezone" value={value.timezone} onChange={(e) => set("timezone", e.target.value)} className={inputClass}>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-[14px] text-gray-900 cursor-pointer">
          <input
            type="checkbox"
            checked={value.notifyOnFailure}
            onChange={(e) => set("notifyOnFailure", e.target.checked)}
            className="w-4 h-4 accent-[#4F46E5]"
          />
          Email me if a sync fails
        </label>
        {value.notifyOnFailure && (
          <Field label="Notification email" htmlFor="notificationEmail" hint="The address that receives failure alerts">
            <input
              id="notificationEmail"
              type="email"
              value={value.notificationEmail}
              onChange={(e) => set("notificationEmail", e.target.value)}
              placeholder="name@company.com"
              className={inputClass}
            />
          </Field>
        )}
      </div>

      <StepFooter onBack={onBack} submitLabel="Save & finish" saving={saving} error={error} />
    </form>
  );
};

/* ------------ 4. Delivery (Slack: real time, no schedule) ------------ */
export const DeliveryStep: React.FC<
  StepProps<ScheduleConfig> & {
    channel: string;
    onChannelChange: (channel: string) => void;
    // Resolves to an error message, or null when the message was posted
    onSendTest: () => Promise<string | null>;
  }
> = ({ value, onChange, channel, onChannelChange, onSendTest, onBack, onSubmit, saving, error }) => {
  const set = <K extends keyof ScheduleConfig>(key: K, v: ScheduleConfig[K]) => onChange({ ...value, [key]: v });
  const [channelError, setChannelError] = React.useState<string | null>(null);
  const [test, setTest] = React.useState<{ state: "idle" | "sending" | "sent" | "failed"; message?: string }>({ state: "idle" });

  const validChannel = () => {
    const ok = isValidSlackChannel(channel);
    setChannelError(ok ? null : SLACK_CHANNEL_ERROR);
    return ok;
  };

  const sendTest = async () => {
    if (!validChannel()) return;
    setTest({ state: "sending" });
    const failure = await onSendTest();
    setTest(failure ? { state: "failed", message: failure } : { state: "sent" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validChannel()) onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <StepHeading
        title="Delivery"
        description="Slack messages are sent in real time, as soon as each event happens. There's no schedule to set."
      />

      <Field
        label="Slack channel"
        htmlFor="deliveryChannel"
        hint="The channel where messages are posted (e.g., #trustwell-alerts). For private channels, invite your Slack app to the channel first."
        error={channelError}
      >
        <input
          id="deliveryChannel"
          type="text"
          value={channel}
          onChange={(e) => {
            onChannelChange(e.target.value);
            setChannelError(null);
            setTest({ state: "idle" });
          }}
          placeholder="#trustwell-alerts"
          aria-invalid={!!channelError}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-[8px] border border-gray-300">
        <span>
          <span className="block text-[14px] font-semibold text-gray-950">Send a test message</span>
          <span className="block text-[13px] text-gray-600">Confirms Trustwell can post to this channel.</span>
          {test.state === "sent" && (
            <span role="status" className="block mt-1 text-[13px] font-medium text-[#166534]">
              ✓ Test message sent. Check the channel in Slack.
            </span>
          )}
          {test.state === "failed" && (
            <span role="alert" className="block mt-1 text-[13px] font-medium text-red-700">
              {test.message}
            </span>
          )}
        </span>
        <button type="button" onClick={sendTest} disabled={saving || test.state === "sending"} className={secondaryButtonClass}>
          {test.state === "sending" ? "Sending..." : "Send test message"}
        </button>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-[14px] text-gray-900 cursor-pointer">
          <input
            type="checkbox"
            checked={value.notifyOnFailure}
            onChange={(e) => set("notifyOnFailure", e.target.checked)}
            className="w-4 h-4 accent-[#4F46E5]"
          />
          Email me if Slack delivery fails
        </label>
        {value.notifyOnFailure && (
          <Field label="Notification email" htmlFor="notificationEmail" hint="The address that receives delivery failure alerts">
            <input
              id="notificationEmail"
              type="email"
              value={value.notificationEmail}
              onChange={(e) => set("notificationEmail", e.target.value)}
              placeholder="name@company.com"
              className={inputClass}
            />
          </Field>
        )}
      </div>

      <StepFooter onBack={onBack} submitLabel="Save & finish" saving={saving} error={error} />
    </form>
  );
};

/* ------------ 5. Complete ------------ */
export function describeSchedule(s: ScheduleConfig) {
  if (!s.enabled) return "Manual only";
  const freq = FREQUENCIES.find((f) => f.value === s.frequency)?.label ?? s.frequency;
  if (s.frequency === "daily") return `${freq} at ${s.time} (${s.timezone})`;
  if (s.frequency === "weekly") return `${freq} on ${capitalize(s.dayOfWeek)} at ${s.time} (${s.timezone})`;
  return freq;
}

export const CompleteStep: React.FC<{
  integration: Integration;
  connection: IntegrationConfigure;
  dataSync: DataSyncConfig;
  schedule: ScheduleConfig;
  saved: { connection: boolean; dataSync: boolean; schedule: boolean };
  onEdit: (step: number) => void;
  onDone: () => void;
}> = ({ integration, connection, dataSync, schedule, saved, onEdit, onDone }) => {
  const isSlack = isSlackIntegration(integration.id);
  const slack = connection as SlackConfigure;
  const selected = SYNC_OPTIONS[integration.id]?.options
    .filter((o) => dataSync.objects.includes(o.value))
    .map((o) => o.label)
    .join(", ");
  const channel = slack.channelName?.trim() ? `#${slack.channelName.trim().replace(/^#/, "")}` : "";
  const rows = [
    {
      label: "Connection",
      value: saved.connection ? (isSlack && slack.workspaceName ? `Connected to ${slack.workspaceName}` : "Credentials saved") : null,
      step: 1,
    },
    { label: "Data sync", value: saved.dataSync ? selected || "Default settings" : null, step: 2 },
    isSlack
      ? { label: "Delivery", value: saved.schedule ? `Real time, posted to ${channel}` : null, step: 3 }
      : { label: "Schedule", value: saved.schedule ? describeSchedule(schedule) : null, step: 3 },
  ];
  const allSaved = rows.every((r) => r.value);

  return (
    <div className="py-4">
      <div className="text-center mb-8">
        <span
          className={`inline-flex items-center justify-center w-14 h-14 rounded-full text-2xl mb-4 ${
            allSaved ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEF3C7] text-[#92400E]"
          }`}
          aria-hidden="true"
        >
          {allSaved ? "✓" : "!"}
        </span>
        <h2 className="text-xl font-bold text-gray-950 mb-2">
          {allSaved ? `${integration.name} is connected` : `${integration.name} setup isn't finished`}
        </h2>
        <p className="text-sm text-gray-600">
          {allSaved ? "Your settings are saved. You can change them at any time." : "Some steps haven't been saved yet. You can finish them any time."}
        </p>
      </div>

      <dl className="divide-y divide-gray-200 border border-gray-200 rounded-[8px] mb-8">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <dt className="w-28 text-[13px] font-semibold text-gray-600">{r.label}</dt>
            <dd className={`flex-1 min-w-0 text-[14px] ${r.value ? "text-gray-950" : "text-gray-600 italic"}`}>
              {r.value ?? "Not set up yet"}
            </dd>
            <button
              type="button"
              onClick={() => onEdit(r.step)}
              className="text-[13px] font-medium text-[#4F46E5] hover:underline focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#0071EC] rounded"
            >
              Edit
            </button>
          </div>
        ))}
      </dl>

      <div className="flex justify-center">
        <button type="button" onClick={onDone} className={primaryButtonClass}>
          Back to integrations
        </button>
      </div>
    </div>
  );
};
