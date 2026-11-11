import { installMarketplaceBridge } from './bridge';

// No production Etsy adapter is installed until real Etsy DOM fixtures are reviewed.
installMarketplaceBridge(null, {
  addListener: (listener) => chrome.runtime.onMessage.addListener(
    listener as Parameters<typeof chrome.runtime.onMessage.addListener>[0],
  ),
});
