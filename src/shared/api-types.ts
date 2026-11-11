export interface ApiSettings {
  baseUrl: string;
  apiKey: string;
  cloudflareAccessClientId?: string;
  cloudflareAccessClientSecret?: string;
}

export interface PublicSettings {
  baseUrl: string;
  hasApiKey: boolean;
  hasCloudflareAccess: boolean;
}

export interface UsageResponse {
  enforced: boolean;
  plan: string;
  monthlyQuota: number | null;
  used: number;
  remaining: number | null;
  periodStart: string;
  resetAt: string;
  packs: string[];
}

export interface ConnectionResult {
  health: { status: 'UP' };
  usage: UsageResponse;
}

export type ExtensionMessage =
  | { type: 'GET_SETTINGS' }
  | {
      type: 'SAVE_SETTINGS';
      settings: {
        baseUrl: string;
        apiKey?: string;
        cloudflareAccessClientId?: string;
        cloudflareAccessClientSecret?: string;
      };
    }
  | { type: 'CHECK_CONNECTION' };

export type ExtensionMessageResponse<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string; requestId?: string } };
