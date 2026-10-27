import React from "react";
import { Integration } from "../data/integrations";
import { primaryButtonClass, secondaryButtonClass } from "./wizard/ui";

interface RequestLicenseProps {
  integration: Integration;
  onBack: () => void;
}

// Booking link for the account manager call (e.g. a Calendly/HubSpot meetings URL)
const SCHEDULE_CALL_URL = import.meta.env.VITE_SCHEDULE_CALL_URL as string | undefined;

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "w-4 h-4",
  "aria-hidden": true,
};

const SyncIcon = () => (
  <svg {...iconProps}>
    <path d="M4 8h14l-3-3M20 16H6l3 3" />
  </svg>
);

const SlidersIcon = () => (
  <svg {...iconProps}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8M4 12h16" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </svg>
);

const PeopleIcon = () => (
  <svg {...iconProps}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 20a6 6 0 0112 0M16 5a3 3 0 010 6M18 14a5 5 0 013 6" />
  </svg>
);

const CalendarIcon = () => (
  <svg {...iconProps}>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M8 3v4M16 3v4M4 10h16" />
  </svg>
);

const BENEFITS = [
  { icon: <SyncIcon />, title: "Reduce manual data entry", text: "Connect your systems to simplify ingredient and recipe updates." },
  { icon: <SlidersIcon />, title: "Map your data to your workflow", text: "Align fields and sync settings with your team's needs." },
  { icon: <PeopleIcon />, title: "Get help with setup", text: "Work with our team to confirm requirements and implementation scope." },
];

// Shown when the integration is not included in the customer's subscription (status "disabled")
export const RequestLicense: React.FC<RequestLicenseProps> = ({ integration, onBack }) => (
  <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
    <div className="max-w-3xl mx-auto">
      <button
        onClick={onBack}
        className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-indigo-600 mb-6 transition-colors"
      >
        <span className="mr-2">←</span> Back to integrations
      </button>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sm:p-8">
        <div className="flex items-center space-x-4 border-b border-gray-200 pb-6 mb-6">
          <img src={integration.iconUrl} alt="" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="text-xl font-bold text-gray-950">{integration.name}</h1>
            <p className="text-sm text-gray-600">{integration.badge || integration.category}</p>
          </div>
        </div>

        <div className="text-center py-4">
          <img src={integration.iconUrl} alt="" className="w-16 h-16 object-contain mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-950 mb-2">Connect {integration.name} to Trustwell</h2>
          <p className="text-sm text-gray-600 max-w-md mx-auto mb-8">
            Connect your ingredient and recipe workflows across {integration.name} and Genesis Foods.
          </p>

          <ul className="text-left max-w-sm mx-auto space-y-4 mb-8">
            {BENEFITS.map((b) => (
              <li key={b.title} className="flex gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#E0E7FF] text-[#4338CA] shrink-0">
                  {b.icon}
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-gray-950">{b.title}</p>
                  <p className="text-[13px] text-gray-600">{b.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="max-w-md mx-auto bg-[#F5F5FF] border border-[#E0E7FF] rounded-[8px] px-6 py-5 mb-8">
            <p className="text-[15px] font-semibold text-gray-950 mb-2">Add this integration to your subscription</p>
            <p className="text-[14px] text-gray-600">
              {integration.name} is not included in your current subscription. Meet with your account manager to
              review your requirements, pricing, and next steps.
            </p>
          </div>

          <a
            href={SCHEDULE_CALL_URL || "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => !SCHEDULE_CALL_URL && e.preventDefault()}
            className={`${primaryButtonClass} inline-flex items-center gap-2`}
          >
            <CalendarIcon />
            Schedule a call with your account manager
          </a>
          <p className="text-[13px] text-gray-600 mt-3 mb-6">
            Already purchased? Contact your account manager to confirm access.
          </p>

          <button type="button" onClick={onBack} className={secondaryButtonClass}>
            Back to integrations
          </button>
        </div>
      </div>
    </div>
  </div>
);
