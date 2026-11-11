import { ApiClientError, ListingGuardApiClient } from './api-client';
import type { ApiSettings, ExtensionMessage, ExtensionMessageResponse, PublicSettings } from '../shared/api-types';

const STORAGE_KEY = 'listingGuardSettings';
const apiClient = new ListingGuardApiClient();

function isOptionsPage(sender: chrome.runtime.MessageSender): boolean {
  return sender.url === chrome.runtime.getURL('src/options/index.html');
}

function isExtensionMessage(value: unknown): value is ExtensionMessage {
  return typeof value === 'object' && value !== null && 'type' in value;
}

function safeError(error: unknown): ExtensionMessageResponse<never> {
  if (error instanceof ApiClientError) {
    return {
      ok: false,
      error: { message: error.message, ...(error.requestId ? { requestId: error.requestId } : {}) },
    };
  }
  return { ok: false, error: { message: 'Không thể xử lý yêu cầu cấu hình Listing Guard.' } };
}

async function readSettings(): Promise<ApiSettings | undefined> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] as ApiSettings | undefined;
}

async function handleMessage(message: ExtensionMessage): Promise<ExtensionMessageResponse<unknown>> {
  if (message.type === 'GET_SETTINGS') {
    const settings = await readSettings();
    const publicSettings: PublicSettings = {
      baseUrl: settings?.baseUrl ?? '',
      hasApiKey: Boolean(settings?.apiKey),
      hasCloudflareAccess: Boolean(settings?.cloudflareAccessClientId && settings.cloudflareAccessClientSecret),
    };
    return { ok: true, data: publicSettings };
  }

  if (message.type === 'SAVE_SETTINGS') {
    const previous = await readSettings();
    const apiKey = message.settings.apiKey?.trim() || previous?.apiKey;
    if (!apiKey) {
      return { ok: false, error: { message: 'Vui lòng nhập API key trước khi lưu cấu hình.' } };
    }

    const baseUrl = new URL(message.settings.baseUrl);
    if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
      return { ok: false, error: { message: 'Base URL phải là địa chỉ HTTP(S), không chứa thông tin đăng nhập hoặc query.' } };
    }
    const originPermission = `${baseUrl.origin}/*`;
    if (!await chrome.permissions.contains({ origins: [originPermission] })) {
      return { ok: false, error: { message: 'Cấp quyền host API trước khi lưu cấu hình.' } };
    }

    const hasClientId = Boolean(message.settings.cloudflareAccessClientId?.trim());
    const hasClientSecret = Boolean(message.settings.cloudflareAccessClientSecret?.trim());
    if (hasClientId !== hasClientSecret) {
      return { ok: false, error: { message: 'Nhập cả Cloudflare Access Client ID và Secret, hoặc để trống cả hai.' } };
    }

    const saved: ApiSettings = {
      baseUrl: baseUrl.toString().replace(/\/+$/, ''),
      apiKey,
      ...(hasClientId && hasClientSecret
        ? {
            cloudflareAccessClientId: message.settings.cloudflareAccessClientId?.trim(),
            cloudflareAccessClientSecret: message.settings.cloudflareAccessClientSecret?.trim(),
          }
        : {}),
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: saved });
    return { ok: true, data: { saved: true } };
  }

  const settings = await readSettings();
  if (!settings) {
    return { ok: false, error: { message: 'Hãy lưu cấu hình API trước khi kiểm tra kết nối.' } };
  }
  const connection = await apiClient.checkConnection(settings);
  return { ok: true, data: connection };
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!isOptionsPage(sender) || !isExtensionMessage(message)) {
    return false;
  }

  void handleMessage(message).then(sendResponse).catch((error: unknown) => sendResponse(safeError(error)));
  return true;
});
