document.addEventListener("DOMContentLoaded", () => {
  const focusToggle = document.getElementById("focusToggle");
  const zenToggle = document.getElementById("zenToggle");
  const wideToggle = document.getElementById("wideToggle");

  // Load current state from storage
  chrome.storage.sync.get(["focusModeEnabled", "zenModeEnabled", "wideModeEnabled"], (data) => {
    focusToggle.checked = data.focusModeEnabled || false;
    zenToggle.checked = data.zenModeEnabled || false;
    wideToggle.checked = data.wideModeEnabled || false;
  });

  focusToggle.addEventListener("change", async (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.sync.set({ focusModeEnabled: isEnabled });
    sendMessageToTab("toggleFocusMode", isEnabled);
  });

  wideToggle.addEventListener("change", async (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.sync.set({ wideModeEnabled: isEnabled });
    sendMessageToTab("toggleWideMode", isEnabled);
  });

  zenToggle.addEventListener("change", async (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.sync.set({ zenModeEnabled: isEnabled });
    sendMessageToTab("toggleZenMode", isEnabled);
  });

  async function sendMessageToTab(action, enabled) {
    // Send message to active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && (tab.url.includes("x.com") || tab.url.includes("twitter.com"))) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action, enabled });
      } catch (err) {
        console.log("Could not send message to tab, maybe not fully loaded.");
      }
    }
  }
});
