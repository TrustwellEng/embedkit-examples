export interface Integration {
  id: string;
  name: string;
  category: string;
  iconUrl: string;
  badge: string;
  isFeatured?: boolean;
  isConfigured?: boolean;
}

export interface IntegrationConfigure {
  id: string;
}

export interface OracleConfigure extends IntegrationConfigure  {
  apiUrl?: string;
  apiAccountId?: string; 
  apiUsername?: string;
  apiToken?: string;
}

export interface SlackConfigure extends IntegrationConfigure  {
  clientId?: string;
  clientSerect?: string; 
  accessToken?: string;
  channelName?: string;
}

export interface SapConfigure extends IntegrationConfigure  {
  odataUrl?: string;
  userName?: string; 
  password?: string;
  clientNumber?: string; 	
}

export interface NetsuiteConfigure extends IntegrationConfigure {
  url?: string;
  user?: string;
  password?: string;
  accountNumber?: string;
  useBoomiRecord?: boolean;
  consumerKey?: string;
  consumerSecret?: string;
  consumerSecretDeprecated?: string;
  tokenId?: string;
  tokenSecret?: string;
  tokenSecretDeprecated?: string;
  applicationId?: string;
  version?: string;
  numberofRetries?: string;
  maxConcurrentConnections?: string;
}
// Wizard step 3 (stored in DataSyncCredential.configPayload). Mock options for now.
export interface DataSyncConfig {
  syncDirection: "genesis_to_app" | "app_to_genesis" | "bidirectional";
  objects: string[];
  syncMode: "incremental" | "full";
  conflictResolution: "genesis_wins" | "app_wins";
}

// Wizard step 4 (stored in ScheduleCredential.configPayload)
export interface ScheduleConfig {
  enabled: boolean;
  frequency: "every_15_minutes" | "hourly" | "daily" | "weekly";
  time: string;
  dayOfWeek: string;
  timezone: string;
  notifyOnFailure: boolean;
  notificationEmail: string;
}
