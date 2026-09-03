import React, { useState, useEffect } from "react";
import { Integration, IntegrationConfigure, NetsuiteConfigure, OracleConfigure, SapConfigure, SlackConfigure } from "../data/integrations";

interface DetailProps {
  integration: Integration;
  onBack: () => void;
}
const base = import.meta.env.VITE_SERVER_URL as string;
const SlackDetails = ({ formData, handleChange }: { formData: SlackConfigure; handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
  <>
    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Client ID</label>
      <input
        type="text"
        name="clientId"
        value={formData.clientId || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
        required
      />
    </div>

    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Client Secret</label>
      <input
        type="password"
        name="clientSerect"
        value={formData.clientSerect || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] font-mono leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
        required
      />
    </div>

    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Access Token</label>
      <input
        type="password"
        name="accessToken"
        value={formData.accessToken || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] font-mono leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
        required
      />
    </div>

    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">Channel Name</label>
      <input
        type="text"
        name="channelName"
        value={formData.channelName || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
        required
      />
    </div>
  </>
);
const DefaultDetails = ({ formData, handleChange }: { formData: OracleConfigure; handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
  <>
    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">API_URL</label>
      <input
        type="text"
        name="apiUrl"
        value={formData.apiUrl || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
        required
      />
    </div>
    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">API_ACCOUNT_ID</label>
      <input
        type="text"
        name="apiAccountId"
        value={formData.apiAccountId || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
        required
      />
    </div>
    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">API_USERNAME</label>
      <input
        type="text"
        name="apiUsername"
        value={formData.apiUsername|| ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
        required
      />
    </div>
    <div className="flex flex-col">
      <label className="block text-[14px] font-semibold text-black mb-1">API_TOKEN</label>
      <input
        type="password"
        name="apiToken"
        value={formData.apiToken || ""}
        onChange={handleChange}
        className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] font-mono leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
        required
      />
    </div>
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
        required
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
        required
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
        required
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
        required
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

export const Detail: React.FC<DetailProps> = ({ integration, onBack }) => {
  const [formData, setFormData] = useState<IntegrationConfigure>({id: integration.id});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const isSlack = integration.id === "slack_integration" || integration.id === "stack_integration";
  const isSap = integration.id === "sap_s4hana";
  const isNetsuite = integration.id === "netsuite";

  const queryParams = new URLSearchParams(window.location.search);
  const genesisId = queryParams.get("genesisId");
  const apiToken = queryParams.get("api_token");

  useEffect(() => {
    const fetchConfigFromDB = async () => {
      if (!genesisId || !apiToken) return;
      setIsLoading(true);

      try {
        const response = await fetch(
          `${base}/api/credentials/${integration.id}?genesisId=${genesisId}&api_token=${apiToken}`,
          {
            method: "GET",
            headers: {
              "x-genesis-customer-id": genesisId,
              "x-genesis-auth-token": apiToken,
            },
          }
        );

            console.log("Response:", response);

        if (response.ok) {
          const data = await response.json();
          if (data && data.configPayload) {
            setFormData(JSON.parse(data.configPayload));
          } else {
            setDefaultInitialValues();
          }
        } else {
          setDefaultInitialValues();
        }
      } catch (error) {
        console.error("Failed to load credentials", error);
        setDefaultInitialValues();
      } finally {
        setIsLoading(false);
      }
    };

    const setDefaultInitialValues = () => {
      if (isSlack) {
        setFormData({
          id: integration.id,
          clientId: "",
          clientSerect: "",
          accessToken: "",
          channelName: "",
        } as SlackConfigure);
      }
      else if (isNetsuite) {
        setFormData({
          id: integration.id,
          accountId: "",
          consumerKey: "",
          consumerSecret: "",
          tokenId: ""
        } as NetsuiteConfigure);
      }
      else if (isSap) {
        setFormData({
          id: integration.id,
          odataUrl: "",
          userName: "",
          password: "",
          clientNumber: "" 
        } as SapConfigure);
      }
      else {
        setFormData({
          id: integration.id,
          apiUrl: "",
          apiAccountId: "",
          apiUsername: "",
          apiToken: "",
        } as OracleConfigure);
      }
    };

    fetchConfigFromDB();
  }, [integration.id, isSlack, genesisId, apiToken]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target as any;
    const name = target.name;
    const value = target.type === "checkbox" ? target.checked : target.value;

    console.log("Field changed:", name, value);

    setFormData((prev: any) => ({
      ...prev,
      [name]: value,
    }));
    setSaveStatus(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus("saving...");

    try {
      const response = await fetch(
        `${base}/api/credentials/${integration.id}?genesisId=${genesisId}&api_token=${apiToken}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-genesis-customer-id": genesisId || "",
            "x-genesis-auth-token": apiToken || "",
          },
          body: JSON.stringify(formData),
        }
      );
      
      if (!response.ok) {
        throw new Error("Failed to save credentials");
      }

      setSaveStatus("saved!");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error(error);
      setSaveStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={onBack}
          className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-indigo-600 mb-6 transition-colors"
        >
          <span className="mr-2">←</span> Back to Integrations
        </button>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          <div className="flex items-center space-x-4 border-b border-gray-200 pb-6 mb-6">
            <img
              src={integration.iconUrl}
              alt={integration.name}
              className="w-12 h-12 object-contain"
            />
            <div>
              <h1 className="text-xl font-bold text-gray-950">
                {integration.name} Configuration
              </h1>
              <p className="text-sm text-gray-600">
                {isSlack 
                  ? "Configure Client credentials and channel settings for your integration." 
                  : "Configure connection credentials for database integration."}
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-gray-600 text-sm">
              Loading configuration from DB...
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              {isSlack ? (
                <SlackDetails formData={formData} handleChange={handleChange} />
              ) : isSap ? (
                <SapDetails formData={formData} handleChange={handleChange} />
              ) : isNetsuite ? (
                <NetsuiteDetails formData={formData} handleChange={handleChange} />
              ) : (
                <DefaultDetails formData={formData} handleChange={handleChange} />
              )}
              <div className="pt-6 flex items-center justify-end space-x-4 border-t border-gray-200 mt-2">
                {saveStatus === "saved!" && (
                  <span className="text-sm font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full">
                    ✓ Saved successfully!
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="text-sm font-medium text-red-700 bg-red-100 px-3 py-1 rounded-full">
                    ✕ Failed to save!
                  </span>
                )}

                <button
                  type="button"
                  onClick={onBack}
                  className="px-5 py-2.5 text-[14px] font-medium text-gray-800 bg-white border border-gray-400 rounded-[6px] hover:bg-gray-100 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saveStatus === "saving..."}
                  className="px-6 py-2.5 text-[14px] font-medium text-white bg-[#4F46E5] rounded-[6px] hover:bg-[#4338CA] focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] disabled:opacity-50 transition-colors shadow-sm"
                >
                  {saveStatus === "saving..." ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};