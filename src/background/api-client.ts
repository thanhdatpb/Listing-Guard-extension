import type { ApiSettings, ConnectionResult, UsageResponse } from '../shared/api-types';

export const API_REQUEST_TIMEOUT_MS = 10_000;

export class ApiClientError extends Error {
  readonly requestId?: string;
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, requestId?: string, code?: string, status?: number) {
    super(message);
    this.name = 'ApiClientError';
    this.requestId = requestId;
    this.code = code;
    this.status = status;
  }
}

interface ProblemResponse {
  code?: unknown;
  requestId?: unknown;
}

const problemMessages: Record<string, string> = {
  'unauthorized': 'API key không hợp lệ hoặc đã bị thu hồi.',
  'rate-limited': 'API đang giới hạn lượt gọi. Vui lòng thử lại sau.',
  'quota-exceeded': 'Hạn mức tháng đã dùng hết. Không tự thử lại.',
  'plan-not-allowed': 'Gói hiện tại không cho phép sử dụng chức năng này.',
  'service-unavailable': 'API tạm thời không khả dụng.',
  'trademark-not-configured': 'Dịch vụ kiểm tra nhãn hiệu chưa cấu hình.',
  'internal-error': 'API gặp lỗi nội bộ.',
  'not-found': 'Không tìm thấy endpoint API. Kiểm tra base URL.',
};

function safeRequestId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(value) ? value : undefined;
}

function safeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiClientError('Base URL không hợp lệ.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new ApiClientError('Base URL phải là địa chỉ HTTP(S), không chứa thông tin đăng nhập hoặc query.');
  }

  return url.toString().replace(/\/+$/, '');
}

async function requestJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  headers: HeadersInit,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, {
      method,
      headers: {
        ...Object.fromEntries(new Headers(headers).entries()),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let problem: ProblemResponse = {};
      try {
        problem = (await response.json()) as ProblemResponse;
      } catch {
        // Do not expose response bodies, which are not part of the stable error contract.
      }

      const code = typeof problem.code === 'string' ? problem.code : 'unknown';
      const requestId = safeRequestId(problem.requestId);
      const message = problemMessages[code] ?? 'Không thể kết nối với Listing Guard API.';
      throw new ApiClientError(message, requestId, code, response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new ApiClientError('Yêu cầu quá thời gian chờ 10 giây.');
    }
    throw new ApiClientError('Không thể kết nối với Listing Guard API.');
  } finally {
    clearTimeout(timeout);
  }
}

export class ListingGuardApiClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  private headers(settings: ApiSettings): Record<string, string> {
    return {
      'X-API-Key': settings.apiKey,
      ...(settings.cloudflareAccessClientId && settings.cloudflareAccessClientSecret
        ? {
            'CF-Access-Client-Id': settings.cloudflareAccessClientId,
            'CF-Access-Client-Secret': settings.cloudflareAccessClientSecret,
          }
        : {}),
    };
  }

  async checkConnection(settings: ApiSettings): Promise<ConnectionResult> {
    const baseUrl = safeBaseUrl(settings.baseUrl);
    const accessHeaders: Record<string, string> = {};
    if (settings.cloudflareAccessClientId && settings.cloudflareAccessClientSecret) {
      accessHeaders['CF-Access-Client-Id'] = settings.cloudflareAccessClientId;
      accessHeaders['CF-Access-Client-Secret'] = settings.cloudflareAccessClientSecret;
    }

    const health = await requestJson<{ status?: string }>(
      this.fetchImpl,
      `${baseUrl}/health`,
      accessHeaders,
    );
    if (health.status !== 'UP') {
      throw new ApiClientError('Listing Guard API hiện chưa sẵn sàng.');
    }

    const usage = await requestJson<UsageResponse>(
      this.fetchImpl,
      `${baseUrl}/api/v1/usage`,
      { ...accessHeaders, 'X-API-Key': settings.apiKey },
    );
    return { health: { status: 'UP' }, usage };
  }

  async checkRules(
    settings: ApiSettings,
    request: import('../shared/api-types').ListingCheckRequest,
  ): Promise<import('../shared/api-types').RulesCheckResult> {
    return requestJson(
      this.fetchImpl,
      `${safeBaseUrl(settings.baseUrl)}/api/v1/checks`,
      this.headers(settings),
      'POST',
      request,
    );
  }

  async checkTrademark(
    settings: ApiSettings,
    request: import('../shared/api-types').ListingCheckRequest,
  ): Promise<import('../shared/api-types').TrademarkCheckResult> {
    return requestJson(
      this.fetchImpl,
      `${safeBaseUrl(settings.baseUrl)}/api/v1/trademark-checks`,
      this.headers(settings),
      'POST',
      request,
    );
  }

  async getRulesetLimits(
    settings: ApiSettings,
    marketplace: import('../shared/tsv-mapping').Marketplace,
  ): Promise<import('../shared/api-types').RulesetLimitsResult> {
    return requestJson(
      this.fetchImpl,
      `${safeBaseUrl(settings.baseUrl)}/api/v1/rulesets/${marketplace}/limits`,
      this.headers(settings),
    );
  }

  async getEtsyLimits(settings: ApiSettings): Promise<import('../shared/api-types').RulesetLimitsResult> {
    return this.getRulesetLimits(settings, 'ETSY');
  }
}
