// popup.js — Toggle dark mode on/off

const toggle = document.getElementById("toggle");
const status = document.getElementById("status");

// Load current state
chrome.storage.sync.get({ enabled: true }, (data) => {
  toggle.checked = data.enabled;
  status.textContent = data.enabled ? "Active" : "Disabled";
});

// Save state on toggle
toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  chrome.storage.sync.set({ enabled });
  status.textContent = enabled ? "Active" : "Disabled";

  // Notify all ESPN tabs to update immediately
  chrome.tabs.query({ url: "*://*.espn.com/*" }, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { action: "toggle", enabled });
    }
  });
});
