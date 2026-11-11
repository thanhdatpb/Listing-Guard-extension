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
  tsvColumnMapping: import('./tsv-mapping').TsvColumnMapping;
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

export interface ListingCheckRequest {
  marketplace: import('./tsv-mapping').Marketplace;
  listing: import('../adapters/marketplace-adapter').MarketplaceListingInput;
}

export interface CheckFinding {
  ruleId: string;
  source: 'RULE' | 'LLM';
  severity: 'ERROR' | 'WARNING' | 'INFO';
  field: string;
  value: string | null;
  message: string;
  suggestion: string;
  fix: { action: 'REPLACE' | 'REMOVE'; description: string; proposedValue: string | null } | null;
}

export interface RulesCheckResult {
  checkId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  marketplace: string;
  cached: boolean;
  findings: CheckFinding[];
  readiness: { score: number | null; ready: boolean; status: string; version: string } | null;
}

export interface LimitView {
  field: string;
  kind: 'MAX_LENGTH' | 'MAX_COUNT' | 'MAX_BYTES' | 'MAX_OCCURRENCES' | string;
  value: number;
  unit: 'CODE_POINTS' | 'ITEMS' | 'WORDS' | 'UTF8_BYTES' | 'OCCURRENCES' | string;
  sourceStatus: 'VERIFIED' | 'SECONDARY' | 'UNVERIFIED' | string;
  enabled: boolean;
}

export interface RulesetLimitsResult {
  marketplace: string;
  limits: LimitView[];
}

export interface CheckBundleResult {
  rules: RulesCheckResult;
  limits: LimitView[];
  limitsMessage?: string;
  trademark: TrademarkCheckResult | null;
  trademarkState: 'complete' | 'not-configured' | 'unavailable';
  trademarkMessage?: string;
}

export interface TrademarkFinding {
  field: string;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  message: string;
  suggestion: string;
}

export interface TrademarkCheckResult {
  checkId: string;
  completeness: 'COMPLETE' | 'INCOMPLETE';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  disclaimer: string;
  findings: TrademarkFinding[];
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
  | { type: 'CHECK_CONNECTION' }
  | { type: 'SAVE_TSV_COLUMN_MAPPING'; mapping: import('./tsv-mapping').TsvColumnMapping }
  | { type: 'CHECK_LISTING'; request: ListingCheckRequest; limits: true };

export type ExtensionMessageResponse<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string; requestId?: string; code?: string } };
