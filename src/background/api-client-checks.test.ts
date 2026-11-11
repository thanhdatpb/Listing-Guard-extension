import { describe, expect, it, vi } from 'vitest';
import { ListingGuardApiClient } from './api-client';
import type { ApiSettings } from '../shared/api-types';

const settings: ApiSettings = {
  baseUrl: 'https://api.example.test',
  apiKey: 'secret-key',
  cloudflareAccessClientId: 'access-id',
  cloudflareAccessClientSecret: 'access-secret',
};

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('ListingGuardApiClient listing checks', () => {
  it('sends both checks and limits with credentials only from the service-worker client', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ checkId: 'r', findings: [], readiness: null }))
      .mockResolvedValueOnce(response({ marketplace: 'ETSY', limits: [] }))
      .mockResolvedValueOnce(response({ checkId: 't', disclaimer: 'warning', findings: [], riskLevel: 'UNKNOWN', completeness: 'INCOMPLETE' }));
    const client = new ListingGuardApiClient(fetchMock);
    const request = { marketplace: 'ETSY' as const, listing: { title: 'A title' } };

    await client.checkRules(settings, request);
    await client.getEtsyLimits(settings);
    await client.checkTrademark(settings, request);

    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ['https://api.example.test/api/v1/checks', 'POST'],
      ['https://api.example.test/api/v1/rulesets/ETSY/limits', 'GET'],
      ['https://api.example.test/api/v1/trademark-checks', 'POST'],
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.test/api/v1/checks');
    expect(JSON.parse(String(init?.body))).toEqual(request);
    expect(new Headers(init?.headers).get('X-API-Key')).toBe('secret-key');
    expect(new Headers(init?.headers).get('CF-Access-Client-Secret')).toBe('access-secret');
  });

  it('keeps the RFC 7807 code for the unconfigured trademark result and does not retry', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response({
      code: 'trademark-not-configured', requestId: 'safe-request-9', detail: 'private raw detail',
    }, 503));
    const client = new ListingGuardApiClient(fetchMock);

    await expect(client.checkTrademark(settings, { marketplace: 'ETSY', listing: { title: 'A title' } }))
      .rejects.toMatchObject({
        code: 'trademark-not-configured',
        requestId: 'safe-request-9',
        message: 'Dịch vụ kiểm tra nhãn hiệu chưa cấu hình.',
      });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.body).toContain('A title');
    expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty('detail');
  });

  it('does not retry a 429 quota-exceeded response', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response({
      code: 'quota-exceeded', requestId: 'quota-request-2',
    }, 429));
    const client = new ListingGuardApiClient(fetchMock);

    await expect(client.checkRules(settings, { marketplace: 'ETSY', listing: { title: 'A title' } }))
      .rejects.toMatchObject({
        code: 'quota-exceeded',
        message: 'Hạn mức tháng đã dùng hết. Không tự thử lại.',
      });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
