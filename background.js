// background.js — Service worker for ESPN Dark Mode

// Set default state on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ enabled: true }, (data) => {
    chrome.storage.sync.set({ enabled: data.enabled });
  });
});
