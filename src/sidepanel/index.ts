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

import type { MarketplaceListingInput, EtsyListingInput } from '../adapters/marketplace-adapter';
import { DEFAULT_TSV_COLUMN_MAPPING, mapTsvRow, normalizeManualListing, parseTsvRow, type Marketplace } from '../shared/tsv-mapping';
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
const adapterPanel = document.querySelector<HTMLElement>('#adapter-panel');
const manualPanel = document.querySelector<HTMLElement>('#manual-panel');
const adapterTabButton = document.querySelector<HTMLButtonElement>('#adapter-tab-button');
const manualTabButton = document.querySelector<HTMLButtonElement>('#manual-tab-button');
const manualCheckButton = document.querySelector<HTMLButtonElement>('#manual-check-button');
const manualMarketplace = document.querySelector<HTMLSelectElement>('#marketplace-select');
const manualFields = document.querySelector<HTMLElement>('#manual-fields');
const tsvRowInput = document.querySelector<HTMLTextAreaElement>('#tsv-row');
const parseTsvButton = document.querySelector<HTMLButtonElement>('#parse-tsv-button');
let currentTabId: number | undefined;
let activeMode: 'adapter' | 'manual' = 'adapter';

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
      ? 'Chưa có adapter cho trang này. Chuyển sang tab “Nhập tay” để kiểm tra listing.'
      : 'Không tìm thấy dữ liệu listing trên trang hiện tại.');
  }
  if (!response.listing) throw new Error('Adapter không trả về dữ liệu listing.');
  return { tabId: tab.id, listing: response.listing, fieldSnapshots: response.fieldSnapshots ?? {} };
}

async function submitCheck(
  marketplace: Marketplace,
  listing: MarketplaceListingInput,
  manualMode: boolean,
  fieldSnapshots: Record<string, string> = {},
): Promise<void> {
  if (!status || !results) return;
  results.replaceChildren();
  status.textContent = 'Đang kiểm tra rules, nhãn hiệu và giới hạn API…';
  try {
    const request: ListingCheckRequest = { marketplace, listing };
    const bundle = await sendMessage<CheckBundle>({ type: 'CHECK_LISTING', request, limits: true });
    renderCheckResults(results, bundle.rules, bundle.trademark, bundle.trademarkState, listing, bundle.limits, fieldSnapshots, manualMode);
    status.textContent = [bundle.limitsMessage, bundle.trademarkMessage].filter(Boolean).join(' ')
      || `Đã hoàn tất. ${bundle.rules.findings.length} finding từ rules.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Không thể kiểm tra listing.';
  }
}

async function checkListing(): Promise<void> {
  if (!checkButton || !status) return;
  checkButton.disabled = true;
  status.textContent = 'Đang đọc listing qua marketplace adapter…';
  try {
    const { tabId, listing, fieldSnapshots } = await getListing();
    currentTabId = tabId;
    activeMode = 'adapter';
    await submitCheck('ETSY', listing, false, fieldSnapshots);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Không thể kiểm tra listing.';
  } finally {
    checkButton.disabled = false;
  }
}

async function handleResultClick(event: Event, tabId: number | undefined, manualMode: boolean): Promise<void> {
  if (!(event.target instanceof HTMLElement)) return;
  const button = event.target.closest<HTMLButtonElement>('button');
  if (!button) return;
  if (button.dataset.action === 'copy-suggestion') {
    const value = button.dataset.proposedValue;
    if (value === undefined) return;
    try {
      await navigator.clipboard.writeText(value);
      if (status) status.textContent = 'Đã sao chép giá trị đề xuất.';
    } catch {
      if (status) status.textContent = 'Không thể sao chép. Hãy kiểm tra quyền clipboard của trình duyệt.';
    }
    return;
  }
  if (manualMode || tabId === undefined) return;
  const fieldPath = button.dataset.field;
  if (!fieldPath) return;
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

checkButton?.addEventListener('click', () => { void checkListing(); });
function renderManualFields(marketplace: Marketplace): void {
  if (!manualFields) return;
  const fieldSpecs = marketplace === 'ETSY'
    ? [
        { field: 'title', label: 'Tiêu đề', multiline: false },
        { field: 'tags', label: 'Tags (phân tách bằng dấu phẩy)', multiline: true },
        { field: 'description', label: 'Mô tả', multiline: true },
      ]
    : [
        { field: 'title', label: 'Tiêu đề', multiline: false },
        { field: 'brand', label: 'Thương hiệu', multiline: false },
        { field: 'bullet_points', label: 'Bullet points (mỗi dòng một bullet)', multiline: true },
        { field: 'description', label: 'Mô tả', multiline: true },
        { field: 'search_terms', label: 'Search terms', multiline: false },
        { field: 'product_type', label: 'Product type', multiline: false },
      ];
  manualFields.replaceChildren();
  for (const spec of fieldSpecs) {
    const id = `manual-${spec.field}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = spec.label;
    const input = spec.multiline ? document.createElement('textarea') : document.createElement('input');
    input.id = id;
    input.dataset.manualField = spec.field;
    manualFields.append(label, input);
  }
}

function readManualFields(): Record<string, string> {
  const values: Record<string, string> = {};
  manualFields?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-manual-field]').forEach((input) => {
    if (input.dataset.manualField) values[input.dataset.manualField] = input.value;
  });
  return values;
}

function setManualFields(listing: MarketplaceListingInput): void {
  const record = listing as unknown as Record<string, unknown>;
  manualFields?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-manual-field]').forEach((input) => {
    const field = input.dataset.manualField;
    if (!field) return;
    const value = record[field];
    input.value = Array.isArray(value) ? value.join(field === 'tags' ? ', ' : '\n') : typeof value === 'string' ? value : '';
  });
}

function setActiveTab(mode: 'adapter' | 'manual'): void {
  if (activeMode !== mode) results?.replaceChildren();
  activeMode = mode;
  if (adapterPanel) adapterPanel.hidden = mode !== 'adapter';
  if (manualPanel) manualPanel.hidden = mode !== 'manual';
  adapterTabButton?.setAttribute('aria-selected', String(mode === 'adapter'));
  manualTabButton?.setAttribute('aria-selected', String(mode === 'manual'));
}

async function checkManualListing(): Promise<void> {
  if (!manualCheckButton || !status || !manualMarketplace) return;
  manualCheckButton.disabled = true;
  try {
    const marketplace = manualMarketplace.value as Marketplace;
    const listing = normalizeManualListing(marketplace, readManualFields());
    currentTabId = undefined;
    activeMode = 'manual';
    await submitCheck(marketplace, listing, true);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Không thể kiểm tra listing nhập tay.';
  } finally {
    manualCheckButton.disabled = false;
  }
}

async function parsePastedTsv(): Promise<void> {
  if (!status || !manualMarketplace || !tsvRowInput) return;
  try {
    const row = parseTsvRow(tsvRowInput.value);
    const settings = await sendMessage<{ tsvColumnMapping: typeof DEFAULT_TSV_COLUMN_MAPPING }>({ type: 'GET_SETTINGS' });
    const listing = mapTsvRow(row, manualMarketplace.value as Marketplace, settings.tsvColumnMapping ?? DEFAULT_TSV_COLUMN_MAPPING);
    setManualFields(listing);
    status.textContent = 'Đã điền các trường từ hàng TSV. Kiểm tra nội dung rồi bấm Check listing nhập tay.';
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Không thể đọc hàng TSV.';
  }
}

renderManualFields('ETSY');
manualMarketplace?.addEventListener('change', () => renderManualFields(manualMarketplace.value as Marketplace));
adapterTabButton?.addEventListener('click', () => setActiveTab('adapter'));
manualTabButton?.addEventListener('click', () => setActiveTab('manual'));
manualCheckButton?.addEventListener('click', () => { void checkManualListing(); });
parseTsvButton?.addEventListener('click', () => { void parsePastedTsv(); });
results?.addEventListener('click', (event) => { void handleResultClick(event, currentTabId, activeMode === 'manual'); });

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
