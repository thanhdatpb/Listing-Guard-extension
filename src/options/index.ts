import type {
  ConnectionResult,
  ExtensionMessage,
  ExtensionMessageResponse,
  PublicSettings,
} from '../shared/api-types';
import { validateTsvColumnMapping } from '../shared/tsv-mapping';

function getRequiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error('Không tải được giao diện cài đặt.');
  }
  return element;
}

const form = getRequiredElement<HTMLFormElement>('#settings-form');
const mappingForm = getRequiredElement<HTMLFormElement>('#tsv-mapping-form');
const etsyMappingInput = getRequiredElement<HTMLTextAreaElement>('#etsy-column-mapping');
const amazonMappingInput = getRequiredElement<HTMLTextAreaElement>('#amazon-column-mapping');
const mappingSaveButton = getRequiredElement<HTMLButtonElement>('#save-mapping-button');
const baseUrlInput = getRequiredElement<HTMLInputElement>('#base-url');
const apiKeyInput = getRequiredElement<HTMLInputElement>('#api-key');
const apiKeyState = getRequiredElement<HTMLParagraphElement>('#api-key-state');
const clientIdInput = getRequiredElement<HTMLInputElement>('#cf-access-client-id');
const clientSecretInput = getRequiredElement<HTMLInputElement>('#cf-access-client-secret');
const saveButton = getRequiredElement<HTMLButtonElement>('#save-button');
const checkButton = getRequiredElement<HTMLButtonElement>('#check-button');
const statusSection = getRequiredElement<HTMLElement>('#status');
const statusTitle = getRequiredElement<HTMLHeadingElement>('#status-title');
const statusMessage = getRequiredElement<HTMLParagraphElement>('#status-message');
let hasSavedApiKey = false;

async function sendMessage<T>(message: ExtensionMessage): Promise<T> {
  const response = await chrome.runtime.sendMessage(message) as ExtensionMessageResponse<T>;
  if (!response.ok) {
    throw new Error(response.error.requestId
      ? `${response.error.message}\nMã yêu cầu: ${response.error.requestId}`
      : response.error.message);
  }
  return response.data;
}

function showStatus(kind: 'success' | 'error' | 'info', title: string, message: string): void {
  statusSection.dataset.kind = kind;
  statusTitle.textContent = title;
  statusMessage.textContent = message;
  statusSection.hidden = false;
}

function normalizeBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Nhập địa chỉ API hợp lệ, ví dụ https://listing-guard.example.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Base URL phải dùng HTTP(S) và không chứa thông tin đăng nhập hoặc query.');
  }
  return url;
}

async function loadSettings(): Promise<void> {
  try {
    const settings = await sendMessage<PublicSettings>({ type: 'GET_SETTINGS' });
    baseUrlInput.value = settings.baseUrl;
    const mapping = settings.tsvColumnMapping;
    etsyMappingInput.value = mapping.ETSY.join('\n');
    amazonMappingInput.value = mapping.AMAZON.join('\n');
    hasSavedApiKey = settings.hasApiKey;
    apiKeyState.textContent = settings.hasApiKey
      ? 'API key đã được lưu cục bộ. Để trống nếu bạn không muốn thay đổi.'
      : 'API key được lưu cục bộ trong Chrome.';
    if (settings.hasCloudflareAccess) {
      clientIdInput.placeholder = 'Đã cấu hình; nhập ID mới hoặc để trống để bỏ cấu hình';
      clientSecretInput.placeholder = 'Đã cấu hình; nhập Secret mới hoặc để trống để bỏ cấu hình';
    }
  } catch {
    showStatus('error', 'Không tải được cấu hình', 'Đóng rồi mở lại trang cài đặt extension.');
  }
}

mappingForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void saveColumnMapping();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void saveSettings();
});

async function saveSettings(): Promise<void> {
  saveButton.disabled = true;
  try {
    const baseUrl = normalizeBaseUrl(baseUrlInput.value);
    if (!apiKeyInput.value.trim() && !hasSavedApiKey) {
      showStatus('error', 'Thiếu API key', 'Nhập API key trước khi lưu cấu hình.');
      return;
    }
    const originPattern = `${baseUrl.origin}/*`;
    const permissionGranted = await chrome.permissions.request({ origins: [originPattern] });
    if (!permissionGranted) {
      showStatus('error', 'Chưa cấp quyền API', 'Cho phép truy cập host API để lưu cấu hình.');
      return;
    }

    await sendMessage<{ saved: true }>({
      type: 'SAVE_SETTINGS',
      settings: {
        baseUrl: baseUrl.toString().replace(/\/+$/, ''),
        apiKey: apiKeyInput.value,
        cloudflareAccessClientId: clientIdInput.value,
        cloudflareAccessClientSecret: clientSecretInput.value,
      },
    });

    apiKeyInput.value = '';
    hasSavedApiKey = true;
    clientIdInput.value = '';
    clientSecretInput.value = '';
    apiKeyState.textContent = 'API key đã được lưu cục bộ. Để trống nếu bạn không muốn thay đổi.';
    showStatus('success', 'Đã lưu cấu hình', 'Thông tin được lưu trong chrome.storage.local.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể lưu cấu hình.';
    showStatus('error', 'Không thể lưu cấu hình', message);
  } finally {
    saveButton.disabled = false;
  }
}

async function saveColumnMapping(): Promise<void> {
  mappingSaveButton.disabled = true;
  try {
    const mapping = validateTsvColumnMapping({
      ETSY: etsyMappingInput.value.split(/\r?\n/u),
      AMAZON: amazonMappingInput.value.split(/\r?\n/u),
    });
    await sendMessage<{ saved: true }>({ type: 'SAVE_TSV_COLUMN_MAPPING', mapping });
    showStatus('success', 'Đã lưu ánh xạ cột', 'Chỉ tên field và thứ tự cột được lưu trong chrome.storage.local.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ánh xạ cột không hợp lệ.';
    showStatus('error', 'Không lưu được ánh xạ cột', message);
  } finally {
    mappingSaveButton.disabled = false;
  }
}

checkButton.addEventListener('click', () => {
  void checkConnection();
});

async function checkConnection(): Promise<void> {
  checkButton.disabled = true;
  showStatus('info', 'Đang kiểm tra kết nối', 'Đang gọi /health, sau đó /api/v1/usage.');
  try {
    const result = await sendMessage<ConnectionResult>({ type: 'CHECK_CONNECTION' });
    const usage = result.usage;
    const quota = usage.enforced && usage.monthlyQuota !== null
      ? `${usage.used}/${usage.monthlyQuota} lượt trong tháng`
      : 'quota không áp dụng';
    showStatus('success', 'Kết nối thành công', `API đang hoạt động. Gói ${usage.plan}; ${quota}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể kết nối với Listing Guard API.';
    showStatus('error', 'Kiểm tra kết nối thất bại', message);
  } finally {
    checkButton.disabled = false;
  }
}

void loadSettings();
