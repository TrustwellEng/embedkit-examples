import React from "react";
import { DataSyncConfig, Integration, ScheduleConfig } from "../../data/integrations";
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

export const DEFAULT_DATA_SYNC: DataSyncConfig = {
  syncDirection: "genesis_to_app",
  objects: ["recipes"],
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
export const WelcomeStep: React.FC<{ integration: Integration; onStart: () => void; onCancel: () => void }> = ({
  integration,
  onStart,
  onCancel,
}) => (
  <div className="text-center py-4">
    <img src={integration.iconUrl} alt="" className="w-16 h-16 object-contain mx-auto mb-4" />
    <h2 className="text-xl font-bold text-gray-950 mb-2">Connect {integration.name} to Genesis</h2>
    <p className="text-sm text-gray-600 max-w-md mx-auto mb-8">
      This guide walks you through connecting your {integration.name} account, choosing what data to sync, and how
      often it runs. It takes about 5 minutes.
    </p>

    <ol className="text-left max-w-sm mx-auto space-y-4 mb-8">
      {[
        { title: "Connection", text: `Enter your ${integration.name} credentials` },
        { title: "Data sync", text: "Choose which records to sync and in which direction" },
        { title: "Schedule", text: "Decide when the sync runs" },
      ].map((s, i) => (
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

/* ------------ 3. Data sync (placeholder for now) ------------ */
export const DataSyncStep: React.FC<StepProps<DataSyncConfig>> = ({ onBack, onSubmit, saving, error }) => (
  <form onSubmit={submitHandler(onSubmit)} className="space-y-6">
    <StepHeading title="Data sync" description="Choose what data moves between Genesis and this integration." />

    <div className="flex flex-col items-center justify-center text-center min-h-[240px] px-6 py-10 rounded-[8px] border-2 border-dashed border-gray-300 bg-gray-50">
      <p className="text-[14px] font-semibold text-gray-950">Data sync settings are coming soon</p>
      <p className="mt-1 text-[13px] text-gray-600 max-w-sm">
        You'll be able to pick which records to sync and in which direction here. Continue to set up the schedule.
      </p>
    </div>

    <StepFooter onBack={onBack} submitLabel="Continue" saving={saving} error={error} />
  </form>
);

/* ------------ 4. Schedule ------------ */
export const ScheduleStep: React.FC<StepProps<ScheduleConfig>> = ({ value, onChange, onBack, onSubmit, saving, error }) => {
  const set = <K extends keyof ScheduleConfig>(key: K, v: ScheduleConfig[K]) => onChange({ ...value, [key]: v });
  const needsTime = value.frequency === "daily" || value.frequency === "weekly";

  return (
    <form onSubmit={submitHandler(onSubmit)} className="space-y-6">
      <StepHeading title="Schedule" description="Decide when the sync runs automatically." />

      <label className="flex items-center justify-between gap-4 p-4 rounded-[8px] border border-gray-300 cursor-pointer">
        <span>
          <span className="block text-[14px] font-semibold text-gray-950">Run automatically</span>
          <span className="block text-[13px] text-gray-600">Turn off to only sync when you start it manually.</span>
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
          Email me when a sync fails
        </label>
        {value.notifyOnFailure && (
          <Field label="Notification email" htmlFor="notificationEmail">
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
  dataSync: DataSyncConfig;
  schedule: ScheduleConfig;
  saved: { connection: boolean; dataSync: boolean; schedule: boolean };
  onEdit: (step: number) => void;
  onDone: () => void;
}> = ({ integration, schedule, saved, onEdit, onDone }) => {
  const rows = [
    { label: "Connection", value: saved.connection ? `${integration.name} credentials saved` : null, step: 1 },
    { label: "Data sync", value: saved.dataSync ? "Default settings" : null, step: 2 },
    { label: "Schedule", value: saved.schedule ? describeSchedule(schedule) : null, step: 3 },
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
          {allSaved ? `${integration.name} is set up` : `${integration.name} setup isn't finished`}
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
