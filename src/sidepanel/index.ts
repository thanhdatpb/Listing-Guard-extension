import type {
  ExtensionMessage,
  ExtensionMessageResponse,
  ListingCheckRequest,
  LimitView,
  RulesCheckResult,
  TrademarkCheckResult,
} from '../shared/api-types';
import type { MarketplaceContentResponse } from '../content/bridge';
import { renderCheckResults } from './check-view';

import type { EtsyListingInput } from '../adapters/marketplace-adapter';

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

async function getListing(): Promise<{ tabId: number; listing: EtsyListingInput }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined) throw new Error('Không tìm thấy tab Etsy đang hoạt động.');
  const response = await chrome.tabs.sendMessage(tab.id, { type: 'READ_LISTING' }) as MarketplaceContentResponse;
  if (!response.ok) {
    throw new Error(response.code === 'ADAPTER_UNAVAILABLE'
      ? 'Etsy adapter chưa được cấu hình. Cần fixture DOM Etsy thật trước khi hỗ trợ đọc listing.'
      : 'Không tìm thấy dữ liệu listing trên trang hiện tại.');
  }
  if (!response.listing) throw new Error('Adapter không trả về dữ liệu listing.');
  return { tabId: tab.id, listing: response.listing };
}

async function checkListing(): Promise<void> {
  if (!checkButton || !status || !results) return;
  checkButton.disabled = true;
  status.textContent = 'Đang đọc listing qua marketplace adapter…';
  results.replaceChildren();
  try {
    const { tabId, listing } = await getListing();
    currentTabId = tabId;
    status.textContent = 'Đang kiểm tra rules, nhãn hiệu và giới hạn API…';
    const request: ListingCheckRequest = { marketplace: 'ETSY', listing };
    const bundle = await sendMessage<CheckBundle>({ type: 'CHECK_LISTING', request, limits: true });
    renderCheckResults(results, bundle.rules, bundle.trademark, bundle.trademarkState, listing, bundle.limits);
    status.textContent = [bundle.limitsMessage, bundle.trademarkMessage].filter(Boolean).join(' ')
      || `Đã hoàn tất. ${bundle.rules.findings.length} finding từ rules.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Không thể kiểm tra listing.';
  } finally {
    checkButton.disabled = false;
  }
}

async function locateFinding(event: Event, tabId: number | undefined): Promise<void> {
  if (tabId === undefined) return;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const fieldPath = target.closest<HTMLElement>('[data-field]')?.dataset.field;
  if (!fieldPath) return;
  const indexed = /^(tags|personalization)\[(\d+)\]$/u.exec(fieldPath);
  const field = indexed?.[1] ?? fieldPath;
  if (!['title', 'description', 'tags', 'price', 'quantity', 'personalization'].includes(field)) return;
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'LOCATE_FINDING',
      field,
      index: indexed ? Number(indexed[2]) : 0,
    });
  } catch {
    if (status) status.textContent = 'Không thể chuyển tới trường trên trang listing hiện tại.';
  }
}

results?.addEventListener('click', (event) => { void locateFinding(event, currentTabId); });

checkButton?.addEventListener('click', () => { void checkListing(); });
