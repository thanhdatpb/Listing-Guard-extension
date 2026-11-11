import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  API_REQUEST_TIMEOUT_MS,
  ApiClientError,
  ListingGuardApiClient,
} from './api-client';
import type { ApiSettings } from '../shared/api-types';

const settings: ApiSettings = {
  baseUrl: 'https://api.example.test/',
  apiKey: 'secret-key',
  cloudflareAccessClientId: 'access-id',
  cloudflareAccessClientSecret: 'access-secret',
};

const healthResponse = { status: 'UP' };
const usageResponse = {
  enforced: false,
  plan: 'FREE',
  monthlyQuota: null,
  used: 0,
  remaining: null,
  periodStart: '2026-11-01',
  resetAt: '2026-12-01T00:00:00Z',
  packs: ['listing-rules'],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('ListingGuardApiClient', () => {
  it('calls health before usage and sends only configured credentials', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(healthResponse))
      .mockResolvedValueOnce(jsonResponse(usageResponse));
    const client = new ListingGuardApiClient(fetchMock);

    const result = await client.checkConnection(settings);

    expect(result).toEqual({ health: healthResponse, usage: usageResponse });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [healthUrl, healthInit] = fetchMock.mock.calls[0];
    const [usageUrl, usageInit] = fetchMock.mock.calls[1];
    expect(healthUrl).toBe('https://api.example.test/health');
    expect(new Headers(healthInit?.headers).has('X-API-Key')).toBe(false);
    expect(new Headers(healthInit?.headers).get('CF-Access-Client-Id')).toBe('access-id');
    expect(usageUrl).toBe('https://api.example.test/api/v1/usage');
    expect(new Headers(usageInit?.headers).get('X-API-Key')).toBe('secret-key');
    expect(new Headers(usageInit?.headers).get('CF-Access-Client-Secret')).toBe('access-secret');
    expect(healthInit?.signal).toBeInstanceOf(AbortSignal);
    expect(usageInit?.signal).toBeInstanceOf(AbortSignal);
  });

  it('maps RFC 7807 code to Vietnamese and keeps a safe request id', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse(healthResponse));
    fetchMock.mockResolvedValueOnce(jsonResponse({
      code: 'unauthorized',
      requestId: 'request-123',
      detail: 'Never render raw API error details.',
    }, 401));
    const client = new ListingGuardApiClient(fetchMock);

    await expect(client.checkConnection(settings)).rejects.toMatchObject({
      message: 'API key không hợp lệ hoặc đã bị thu hồi.',
      requestId: 'request-123',
    });
  });

  it('aborts requests after ten seconds', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const client = new ListingGuardApiClient(fetchMock);
    const pending = client.checkConnection(settings);
    const expectation = expect(pending).rejects.toBeInstanceOf(ApiClientError);

    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);
    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
