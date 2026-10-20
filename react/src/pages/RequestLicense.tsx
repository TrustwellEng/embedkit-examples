import React from "react";
import { Integration } from "../data/integrations";

interface RequestLicenseProps {
  integration: Integration;
  onBack: () => void;
}

// Shown for premium integrations the customer has no license for (CustomerIntegration.isEnabled = false).
// Placeholder for now: customer service contact details go here.
export const RequestLicense: React.FC<RequestLicenseProps> = ({ integration, onBack }) => (
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
            <h1 className="text-xl font-bold text-gray-950">Request {integration.name}</h1>
            <p className="text-sm text-gray-600">{integration.badge || integration.category}</p>
          </div>
        </div>

        {/* TODO: customer service contact information */}
        <div className="min-h-[200px]" />
      </div>
    </div>
  </div>
);
