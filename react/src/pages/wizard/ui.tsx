import React from "react";

export const inputClass =
  "box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors";

export const primaryButtonClass =
  "px-6 py-2.5 text-[14px] font-medium text-white bg-[#4F46E5] rounded-[6px] hover:bg-[#4338CA] focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] disabled:opacity-50 transition-colors shadow-sm";

export const secondaryButtonClass =
  "px-5 py-2.5 text-[14px] font-medium text-gray-800 bg-white border border-gray-400 rounded-[6px] hover:bg-gray-100 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] disabled:opacity-50 transition-colors";

export const Field: React.FC<React.PropsWithChildren<{ label: string; htmlFor?: string; hint?: string }>> = ({
  label,
  htmlFor,
  hint,
  children,
}) => (
  <div className="flex flex-col">
    <label htmlFor={htmlFor} className="block text-[14px] font-semibold text-black mb-1">
      {label}
    </label>
    {children}
    {hint && <p className="mt-1 text-[13px] text-gray-600">{hint}</p>}
  </div>
);

// Footer shared by every step: optional Back, status message, primary action
export const StepFooter: React.FC<{
  onBack?: () => void;
  backLabel?: string;
  submitLabel: string;
  saving?: boolean;
  disabled?: boolean;
  error?: string | null;
}> = ({ onBack, backLabel = "Back", submitLabel, saving, disabled, error }) => (
  <div className="pt-6 mt-2 border-t border-gray-200 flex flex-wrap items-center justify-end gap-4">
    {error && (
      <span role="alert" className="mr-auto text-sm font-medium text-red-700 bg-red-100 px-3 py-1 rounded-full">
        ✕ {error}
      </span>
    )}
    {onBack && (
      <button type="button" onClick={onBack} disabled={saving} className={secondaryButtonClass}>
        {backLabel}
      </button>
    )}
    <button type="submit" disabled={saving || disabled} className={primaryButtonClass}>
      {saving ? "Saving..." : submitLabel}
    </button>
  </div>
);
