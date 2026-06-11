/**
 * AI Automation Locator & Script Builder - Background Service Worker
 * Handles extension installation, side panel configuration, and messaging.
 */

// Enable the side panel to open when clicking the extension icon
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Error setting panel behavior:", error));
});

// Relays messages between content script and side panel if needed,
// though direct chrome.runtime.sendMessage also works.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "PING_BACKGROUND") {
    sendResponse({ status: "ALIVE", tabId: sender.tab?.id });
    return true;
  }
  
  // Forward tab-specific queries if needed
  if (message.action === "GET_ACTIVE_TAB_ID") {
    sendResponse({ tabId: sender.tab?.id });
    return true;
  }
});
