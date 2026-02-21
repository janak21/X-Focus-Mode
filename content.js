const STYLE_ID_FOCUS = 'x-focus-mode-style';
const STYLE_ID_ZEN = 'x-zen-mode-style';
const STYLE_ID_WIDE = 'x-wide-mode-style';

function applyFocusMode() {
  if (document.getElementById(STYLE_ID_FOCUS)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID_FOCUS;
  style.innerHTML = `
    /* Hide the left sidebar navigation */
    header[role="banner"] {
      display: none !important;
    }
    
    /* Hide the right sidebar (trends, who to follow, etc.) */
    div[data-testid="sidebarColumn"] {
      display: none !important;
    }

    /* Adjust the main container to center the reading content */
    main[role="main"] {
      align-items: center !important;
      overflow-x: hidden !important;
    }
    
    main[role="main"] > div {
      width: 100% !important;
      display: flex !important;
      justify-content: center !important;
    }
    
    /* Ensure the primary timeline/post column has proper max-width and stays centered */
    div[data-testid="primaryColumn"] {
      /* Overriding X's default min-width to prevent overflow cropping on laptop half-screens */
      min-width: 0 !important;
      max-width: 600px !important;
      width: 100% !important;
      margin: 0 auto !important;
      box-sizing: border-box !important;
      /* Add some padding so text doesn't touch the exact edge of a narrow window */
      padding: 0 16px !important;
    }
  `;
  document.head.appendChild(style);
}

function removeFocusMode() {
  const style = document.getElementById(STYLE_ID_FOCUS);
  if (style) {
    style.remove();
  }
}

function applyWideMode() {
  if (document.getElementById(STYLE_ID_WIDE)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID_WIDE;
  style.innerHTML = `
    /* Expand the primary reading column */
    div[data-testid="primaryColumn"] {
      max-width: 900px !important;
    }
  `;
  document.head.appendChild(style);
}

function removeWideMode() {
  const style = document.getElementById(STYLE_ID_WIDE);
  if (style) {
    style.remove();
  }
}

function applyZenMode() {
  if (document.getElementById(STYLE_ID_ZEN)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID_ZEN;
  style.innerHTML = `
    /* Zen Typography for X */
    div[data-testid="tweetText"] {
      font-size: 1.25rem !important; /* Slightly smaller to prevent pushing bounds */
      line-height: 1.6 !important;
      font-weight: 400 !important;
      letter-spacing: 0.01em !important;
      color: rgba(255, 255, 255, 0.95) !important;
      word-wrap: break-word !important;
      overflow-wrap: break-word !important;
    }
    
    /* Make the article text even more readable if viewing articles */
    article {
      padding: 16px 0 !important;
    }
  `;
  document.head.appendChild(style);
}

function removeZenMode() {
  const style = document.getElementById(STYLE_ID_ZEN);
  if (style) {
    style.remove();
  }
}

// Safely wrap storage initialization to avoid "Extension context invalidated" errors
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
  try {
    chrome.storage.sync.get(["focusModeEnabled", "zenModeEnabled", "wideModeEnabled"], (data) => {
      if (chrome.runtime.lastError) return;
      data = data || {};
      if (data.focusModeEnabled) applyFocusMode();
      if (data.wideModeEnabled) applyWideMode();
      if (data.zenModeEnabled) applyZenMode();
    });
  } catch (e) {
    console.log("X Focus Mode: Context checked and safely handled.");
  }
}

// Listen for messages from the popup toggle
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleFocusMode") {
      if (request.enabled) applyFocusMode();
      else removeFocusMode();
    } else if (request.action === "toggleZenMode") {
      if (request.enabled) applyZenMode();
      else removeZenMode();
    } else if (request.action === "toggleWideMode") {
      if (request.enabled) applyWideMode();
      else removeWideMode();
    }
    sendResponse({ status: "handled" });
  });
}

// X (Twitter) is a single-page app (SPA). The head/body might mutate. 
// Use a MutationObserver to ensure the style stays applied if enabled.
let debounceTimeout;
const observer = new MutationObserver(() => {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      try {
        chrome.storage.sync.get(["focusModeEnabled", "zenModeEnabled", "wideModeEnabled"], (data) => {
          if (chrome.runtime.lastError) return;
          data = data || {};
          if (data.focusModeEnabled && !document.getElementById(STYLE_ID_FOCUS)) {
            applyFocusMode();
          }
          if (data.wideModeEnabled && !document.getElementById(STYLE_ID_WIDE)) {
            applyWideMode();
          }
          if (data.zenModeEnabled && !document.getElementById(STYLE_ID_ZEN)) {
            applyZenMode();
          }
        });
      } catch (e) {
        // Extension context invalidated (e.g., extension was updated or reloaded)
        observer.disconnect();
      }
    } else {
      observer.disconnect();
    }
  }, 100);
});

observer.observe(document.documentElement, { childList: true, subtree: true });
