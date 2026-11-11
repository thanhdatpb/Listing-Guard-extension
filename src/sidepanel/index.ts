import type {
  ExtensionMessage,
  ExtensionMessageResponse,
  ListingCheckRequest,
  LimitView,
  RulesCheckResult,
  TrademarkCheckResult,
} from '../shared/api-types';
import type { MarketplaceContentResponse } from '../content/bridge';
import { findingTarget, renderCheckResults } from './check-view';

import type { EtsyListingInput } from '../adapters/marketplace-adapter';
import { sanitizeFixtureHtml } from '../dev/fixture-sanitizer';

interface CheckBundle {
  rules: RulesCheckResult;
  limits: LimitView[];
  limitsMessage?: string;
  trademark: TrademarkCheckResult | null;
  trademarkState: 'complete' | 'not-configured' | 'unavailable';
  trademarkMessage?: string;
}

const checkButton = document.querySelector<HTMLButtonElement>('#check-button');
const status = document.querySelector<HTMLElement>('#status');
const results = document.querySelector<HTMLElement>('#results');
let currentTabId: number | undefined;

async function sendMessage<T>(message: ExtensionMessage): Promise<T> {
  const response = await chrome.runtime.sendMessage(message) as ExtensionMessageResponse<T>;
  if (!response.ok) {
    throw new Error(response.error.requestId
      ? response.error.message + '\nMã yêu cầu: ' + response.error.requestId
      : response.error.message);
  }
  return response.data;
}

async function getListing(): Promise<{ tabId: number; listing: EtsyListingInput; fieldSnapshots: Record<string, string> }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) throw new Error('Không tìm thấy tab Etsy đang hoạt động.');
  const response = await chrome.tabs.sendMessage(tab.id, { type: 'READ_LISTING' }) as MarketplaceContentResponse;
  if (!response.ok) {
    throw new Error(response.code === 'ADAPTER_UNAVAILABLE'
      ? 'Etsy adapter chưa được cấu hình. Cần fixture DOM Etsy thật trước khi hỗ trợ đọc listing.'
      : 'Không tìm thấy dữ liệu listing trên trang hiện tại.');
  }
  if (!response.listing) throw new Error('Adapter không trả về dữ liệu listing.');
  return { tabId: tab.id, listing: response.listing, fieldSnapshots: response.fieldSnapshots ?? {} };
}

async function checkListing(): Promise<void> {
  if (!checkButton || !status || !results) return;
  checkButton.disabled = true;
  status.textContent = 'Đang đọc listing qua marketplace adapter…';
  results.replaceChildren();
  try {
    const { tabId, listing, fieldSnapshots } = await getListing();
    currentTabId = tabId;
    status.textContent = 'Đang kiểm tra rules, nhãn hiệu và giới hạn API…';
    const request: ListingCheckRequest = { marketplace: 'ETSY', listing };
    const bundle = await sendMessage<CheckBundle>({ type: 'CHECK_LISTING', request, limits: true });
    renderCheckResults(results, bundle.rules, bundle.trademark, bundle.trademarkState, listing, bundle.limits, fieldSnapshots);
    status.textContent = [bundle.limitsMessage, bundle.trademarkMessage].filter(Boolean).join(' ')
      || `Đã hoàn tất. ${bundle.rules.findings.length} finding từ rules.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Không thể kiểm tra listing.';
  } finally {
    checkButton.disabled = false;
  }
}

async function handleResultClick(event: Event, tabId: number | undefined): Promise<void> {
  if (tabId === undefined || !(event.target instanceof HTMLElement)) return;
  const button = event.target.closest<HTMLButtonElement>('button');
  const fieldPath = button?.dataset.field;
  if (!button || !fieldPath) return;
  if (button.dataset.action === 'apply-suggestion') {
    const field = fieldPath;
    const index = Number(button.dataset.index);
    const value = button.dataset.proposedValue;
    const expectedValue = button.dataset.expectedValue;
    if (!['title', 'description', 'tags', 'price', 'quantity', 'personalization'].includes(field)
      || !Number.isInteger(index) || index < 0 || value === undefined || expectedValue === undefined) return;
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'FILL_SUGGESTION',
        field,
        index,
        value,
        expectedValue,
      }) as MarketplaceContentResponse;
      if (response.ok && response.filled) {
        if (status) status.textContent = 'Đã điền gợi ý. Chưa lưu và chưa chạy kiểm tra lại.';
      } else if (!response.ok && response.code === 'FIELD_CHANGED') {
        if (status) status.textContent = 'Ô đã thay đổi từ lúc kiểm tra. Hãy chạy Check thủ công trước khi áp dụng gợi ý.';
      } else {
        if (status) status.textContent = 'Không thể điền gợi ý vào trường này.';
      }
    } catch {
      if (status) status.textContent = 'Không thể gửi gợi ý tới trang listing hiện tại.';
    }
    return;
  }

  const targetField = findingTarget(fieldPath);
  if (!targetField) return;
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'LOCATE_FINDING',
      field: targetField.field,
      index: targetField.index,
    });
  } catch {
    if (status) status.textContent = 'Không thể chuyển tới trường trên trang listing hiện tại.';
  }
}

results?.addEventListener('click', (event) => { void handleResultClick(event, currentTabId); });

checkButton?.addEventListener('click', () => { void checkListing(); });
async function exportFixture(): Promise<void> {
  if (!status) return;
  status.textContent = 'Đang tạo fixture đã làm sạch…';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new Error('Không tìm thấy tab hiện tại.');
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXPORT_FIXTURE_DOM' }) as MarketplaceContentResponse;
    if (!response.ok || !response.html) throw new Error('Không thể đọc DOM của trang hiện tại.');
    const sanitized = sanitizeFixtureHtml(response.html, tab.url ?? '');
    const url = URL.createObjectURL(new Blob([sanitized.html], { type: 'text/html;charset=utf-8' }));
    await chrome.downloads.download({ url, filename: 'listing-guard-fixture.html', saveAs: true });
    status.textContent = 'Đã tải fixture đã làm sạch. Kiểm tra file trước khi gửi.';
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    status.textContent = 'Không thể xuất fixture. Hãy mở trang soạn Etsy trong tab hiện tại.';
  }
}

if (__DEV_FIXTURE_CAPTURE__) {
  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.className = 'secondary';
  exportButton.textContent = 'Xuất fixture';
  exportButton.addEventListener('click', () => { void exportFixture(); });
  checkButton?.insertAdjacentElement('afterend', exportButton);
}
