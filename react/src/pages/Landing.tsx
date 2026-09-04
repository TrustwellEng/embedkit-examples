import React, { useEffect, useState } from "react";
import { Integration } from "../data/integrations";

interface LandingProps {
  onSelectIntegration: (integration: Integration) => void;
}

const STORAGE_KEY_GENESIS_ID = "genesis_customer_id";
const STORAGE_KEY_API_TOKEN = "genesis_api_token";

export const Landing: React.FC<LandingProps> = ({ onSelectIntegration }) => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [inputGenesisId, setInputGenesisId] = useState<string>("");
  const [inputApiToken, setInputApiToken] = useState<string>("");

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const customerIdUrl = queryParams.get("genesisId");
    const customerId = localStorage.getItem(STORAGE_KEY_GENESIS_ID);
    const apiToken = localStorage.getItem(STORAGE_KEY_API_TOKEN);

    if (!customerId || !apiToken || (customerIdUrl && customerIdUrl !== customerId)) {
      setShowAuthModal(true);
      setLoading(false);
      return;
    }

    const base = import.meta.env.VITE_SERVER_URL as string;

    const validateAndFetch = async () => {
      try {
        const graphqlQuery = {
          query: `
            query($input: FoodSearchInput!) {
              foods {
                search(input: $input) {
                  foodSearchResults {
                    id
                    name
                  }
                }
              }
            }
          `,
          variables: {
            input: {
              searchText: "",
              foodTypes: ["Recipe"],
              itemSourceFilter: "Customer",
              versionFilter: "Latest",
              documentStatusFilter: "All",
              archiveFilter: "Unarchived",
              first: 1,
              after: 0
            }
          }
        };

        const validateResponse = await fetch("https://api-dev.trustwell.com/genesis", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": apiToken
          },
          body: JSON.stringify(graphqlQuery)
        });

        if (!validateResponse.ok) {
          throw new Error("Validation failed: Invalid API Token.");
        }

        const response = await fetch(
          `${base}/api/integrations?genesisId=${encodeURIComponent(
            customerId
          )}`,
          {
            method: "GET",
            headers: {
              "x-genesis-customer-id": customerId,
              "x-genesis-auth-token": apiToken,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Unable to fetch integrations list from server.");
        }

        const data = await response.json();
        setIntegrations(data);
      } catch (err: any) {
        setError(err.message || "An error occurred during authentication.");
      } finally {
        setLoading(false);
      }
    };
    validateAndFetch();
  }, []);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputGenesisId.trim() || !inputApiToken.trim()) return;

    localStorage.setItem(STORAGE_KEY_GENESIS_ID, inputGenesisId.trim());
    localStorage.setItem(STORAGE_KEY_API_TOKEN, inputApiToken.trim());
    const newParams = new URLSearchParams(window.location.search);
    newParams.set("genesisId", inputGenesisId.trim());

    window.location.search = newParams.toString();
  };

  const handleClearAuth = () => {
    localStorage.removeItem(STORAGE_KEY_GENESIS_ID);
    localStorage.removeItem(STORAGE_KEY_API_TOKEN);
    window.location.search = "";
    window.location.reload();
  };

  if (showAuthModal) {
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-2xl w-full">
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
            <div className="border-b border-gray-200 pb-6 mb-6">
              <h1 className="text-xl font-bold text-gray-950 mb-1">
                Genesis Authentication Required
              </h1>
            </div>
            <form onSubmit={handleAuthSubmit} className="space-y-6">
              <div className="flex flex-col">
                <label className="block text-[14px] font-semibold text-black mb-1">GENESIS ID</label>
                <input
                  type="text"
                  value={inputGenesisId}
                  onChange={(e) => setInputGenesisId(e.target.value)}
                  className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
                  required
                />
              </div>
              <div className="flex flex-col">
                <label className="block text-[14px] font-semibold text-black mb-1">API TOKEN</label>
                <input
                  type="password"
                  value={inputApiToken}
                  onChange={(e) => setInputApiToken(e.target.value)}
                  className="box-border w-full h-[40px] px-[12px] bg-white border border-gray-400 rounded-[6px] text-gray-900 text-[14px] font-mono leading-[1.2] placeholder-gray-500 hover:border-gray-600 focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] focus:border-[#0071EC] focus:ring-0 transition-colors"
                  required
                />
              </div>
              <div className="pt-6 flex items-center justify-end space-x-4 border-t border-gray-200 mt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 text-[14px] font-medium text-white bg-[#4F46E5] rounded-[6px] hover:bg-[#4338CA] focus:outline focus:outline-[3px] focus:outline-[#0071EC] focus:outline-offset-[2px] transition-colors shadow-sm"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white py-8 px-8 flex items-center justify-center">
        <p className="text-gray-500 font-medium">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white py-8 px-8 flex flex-col items-center justify-center">
        <p className="text-red-500 font-medium mb-4">Error: {error}</p>
        <button
          onClick={handleClearAuth}
          className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg"
        >
          Re-enter information
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-8 px-8">
      <div className="max-w-[1200px] mx-auto">
         <h1 className="text-xl font-bold text-black mb-6">Integrations</h1>
        {/* <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold text-black">Integrations</h1>
          <button
            onClick={handleClearAuth}
            className="text-xs text-gray-500 hover:text-red-600 underline"
          >
            Clear Auth / Logout
          </button>
        </div> */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          
          {integrations.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectIntegration(item)}
              className="box-border bg-white border border-[#E5E7EB] rounded-[12px] text-center cursor-pointer transition-all duration-[120ms] ease-in-out flex flex-col items-center justify-center aspect-square p-4 hover:border-2 hover:border-[#003F9C] hover:-m-[1px] focus-visible:border-2 focus-visible:border-[#003F9C] focus-visible:-m-[1px] focus-visible:outline-none relative"
            >
              {item.isConfigured && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-green-500 rounded-full" title="Configured" />
              )}

              <div className="w-12 h-12 flex items-center justify-center mb-3">
                <img
                  src={item.iconUrl}
                  alt={item.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            
              <h3 className="m-0 text-[14px] font-bold text-[#000000] leading-normal mb-2">
                {item.name}
              </h3>
              
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