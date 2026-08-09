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

function normalizeArticleText(value) {
  return (value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getArticleRoot() {
  const selectors = [
    '[data-testid="twitterArticleReadView"]',
    '[data-testid="twitterArticleReader"]',
    '[data-testid="twitterArticleRichTextView"]',
    '[data-testid="longformRichTextComponent"]',
    '[data-testid="article"]',
    '[data-testid="articleBody"]'
  ];

  for (const selector of selectors) {
    const root = document.querySelector(selector);
    if (root) return root;
  }

  return null;
}

function isUsableArticleMediaUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

function getCapturedVideoUrl(video) {
  const candidates = [
    video.currentSrc,
    video.src,
    video.getAttribute('src'),
    video.getAttribute('data-src'),
    video.getAttribute('data-url'),
    video.getAttribute('data-video-url'),
    video.querySelector('source')?.src,
    video.querySelector('source')?.getAttribute('src')
  ];
  const directSource = candidates.find(isUsableArticleMediaUrl);
  if (directSource) return directSource;

  try {
    const resources = typeof performance !== 'undefined' &&
      typeof performance.getEntriesByType === 'function'
      ? performance.getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter((url) => /^https?:\/\/video\.twimg\.com\//i.test(url))
        .filter((url) => /\.(?:mp4|m3u8)(?:[?#]|$)/i.test(url))
      : [];
    const poster = video.poster || video.getAttribute('poster') || '';
    const mediaId = poster.match(/(?:ext_tw_video_thumb|tweet_video_thumb|amplify_video)\/(\d+)/i)?.[1];
    const matchingResources = mediaId
      ? resources.filter((url) => url.includes(`/${mediaId}/`))
      : resources;
    const candidatesToUse = matchingResources.length || resources.length === 1
      ? matchingResources.length ? matchingResources : resources
      : [];
    return candidatesToUse.find((url) => /\.mp4(?:[?#]|$)/i.test(url)) ||
      candidatesToUse.at(-1) || '';
  } catch (error) {
    return '';
  }
}

function getArticleMediaItem(element) {
  const tag = element.tagName.toLowerCase();
  if (tag === 'img') {
    const url = element.currentSrc || element.src || element.getAttribute('data-src') || '';
    if (!isUsableArticleMediaUrl(url)) return null;
    if (url.includes('profile_images') || url.includes('/emoji/') || url.endsWith('.svg')) return null;
    return {
      kind: 'image',
      url,
      alt: normalizeArticleText(element.alt) || 'Article image'
    };
  }

  if (tag === 'video') {
    const poster = element.poster || element.getAttribute('poster') || '';
    const usablePoster = isUsableArticleMediaUrl(poster) ? poster : '';
    const url = getCapturedVideoUrl(element);
    if (!url && !usablePoster) return null;
    return {
      kind: 'video',
      url,
      poster: usablePoster,
      alt: 'Article video',
      openUrl: window.location.href.split('#')[0]
    };
  }

  return null;
}

function collectArticleMedia(root, replaceWithMarkers) {
  const media = [];
  const indexes = new Map();

  root.querySelectorAll('img, video').forEach((element) => {
    const item = getArticleMediaItem(element);
    if (!item) return;

    const key = `${item.kind}:${item.url || item.poster}`;
    let index = indexes.get(key);
    if (index === undefined) {
      if (media.length >= 30) return;
      index = media.length;
      indexes.set(key, index);
      media.push(item);
    }

    if (replaceWithMarkers) {
      element.replaceWith(document.createTextNode(`\n\n[[XFM_MEDIA_${index}]]\n\n`));
    }
  });

  return media;
}

function inlineArticleMarkdown(node) {
  if (node.nodeType === 3) return node.nodeValue || '';
  if (node.nodeType !== 1) return '';

  const tag = node.tagName.toLowerCase();
  if (tag === 'br') return '\n';
  if (tag === 'img' || tag === 'video' || tag === 'source') return '';

  const content = Array.from(node.childNodes).map(inlineArticleMarkdown).join('');
  const style = (node.getAttribute('style') || '').toLowerCase();
  const trimmed = content.trim();

  if (tag === 'a' && node.href && trimmed) return `[${trimmed}](${node.href})`;
  if (tag === 'strong' || tag === 'b' || style.includes('font-weight: bold')) {
    return trimmed ? `**${trimmed}**` : '';
  }
  if (tag === 'em' || tag === 'i' || style.includes('font-style: italic')) {
    return trimmed ? `*${trimmed}*` : '';
  }
  if (tag === 'code' && tag !== 'pre') return trimmed ? `\`${trimmed}\`` : '';

  return content;
}

function getArticleBlockKind(block) {
  const classes = Array.from(block.classList || []);
  return classes.find((className) => className.startsWith('longform-')) || '';
}

const CODE_LANGUAGES = new Set([
  'bash', 'sh', 'shell', 'zsh', 'fish', 'powershell', 'ps1',
  'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'ruby',
  'go', 'rust', 'java', 'kotlin', 'swift', 'c', 'cpp', 'csharp',
  'html', 'css', 'json', 'yaml', 'yml', 'sql', 'text', 'plaintext'
]);

const SHELL_COMMAND_PREFIX = /^(?:curl|wget|npm|npx|pnpm|yarn|git|python|python3|node|docker|brew|sudo|chmod|mkdir|cd|echo|export|cat|uv|pip|go|cargo)\b/i;

function getCodeBlockLanguage(block, value) {
  const metadata = [
    getArticleBlockKind(block),
    block.className || '',
    block.getAttribute('data-language') || '',
    block.querySelector('code')?.className || ''
  ].join(' ').toLowerCase();
  const explicit = metadata.match(/(?:language|lang)[-_:=]?([a-z0-9+#.-]+)/i)?.[1];
  if (explicit && CODE_LANGUAGES.has(explicit)) return explicit;

  const firstLine = String(value || '').split(/\r?\n/)[0].trim();
  if (CODE_LANGUAGES.has(firstLine.toLowerCase())) return firstLine.toLowerCase();
  const gluedShellLanguage = firstLine.match(/^(bash|sh|shell|zsh)(?=\s*\S)/i);
  if (gluedShellLanguage && SHELL_COMMAND_PREFIX.test(firstLine.slice(gluedShellLanguage[1].length))) {
    return gluedShellLanguage[1].toLowerCase() === 'shell'
      ? 'bash'
      : gluedShellLanguage[1].toLowerCase();
  }
  if (/\b(?:bash|shell|sh|zsh)\b/i.test(metadata)) return 'bash';
  return '';
}

function cleanCodeBlockText(value, language) {
  const lines = String(value || '').split(/\r?\n/);
  if (language && lines[0].trim().toLowerCase() === language) return lines.slice(1).join('\n').trim();

  if (language && ['bash', 'sh', 'shell', 'zsh'].includes(language)) {
    const firstLine = lines[0].trim();
    const gluedPrefix = firstLine.match(/^(bash|sh|shell|zsh)(?=\s*\S)/i);
    if (gluedPrefix && SHELL_COMMAND_PREFIX.test(firstLine.slice(gluedPrefix[1].length))) {
      lines[0] = firstLine.slice(gluedPrefix[1].length).trimStart();
    }
  }
  return lines.join('\n').trim();
}

function getArticleBlockMarkdown(block) {
  const kind = getArticleBlockKind(block);
  const tag = block.tagName.toLowerCase();
  if (tag === 'ul' || tag === 'ol') return '';
  const isCode = tag === 'pre' || kind.includes('code-block') ||
    block.querySelector('[data-testid="markdown-code-block"]');
  const rawText = isCode ? (block.innerText || block.textContent) : inlineArticleMarkdown(block);
  const language = isCode ? getCodeBlockLanguage(block, rawText) : '';
  const text = normalizeArticleText(isCode ? cleanCodeBlockText(rawText, language) : rawText);
  if (!text) return '';

  const depthMatch = `${kind} ${block.className || ''}`.match(/depth(\d+)/);
  const indent = depthMatch ? '  '.repeat(Number(depthMatch[1])) : '';
  const headingMatch = kind.match(/header-(one|two|three|four|five|six)/);
  if (headingMatch || /^H[1-6]$/.test(block.tagName)) {
    const level = headingMatch
      ? ['one', 'two', 'three', 'four', 'five', 'six'].indexOf(headingMatch[1]) + 1
      : Number(block.tagName.slice(1));
    return `${'#'.repeat(level)} ${text}`;
  }
  if (kind.includes('blockquote') || tag === 'blockquote') {
    return text.split('\n').map((line) => `> ${line}`).join('\n');
  }
  if (kind.includes('unordered-list-item') || tag === 'li' && block.closest('ul')) {
    return `${indent}- ${text}`;
  }
  if (kind.includes('ordered-list-item') || tag === 'li' && block.closest('ol')) {
    return `${indent}1. ${text}`;
  }
  if (isCode) return `\`\`\`${language}\n${text}\n\`\`\``;
  return text;
}

function getArticleText(root) {
  const copy = root.cloneNode(true);
  const media = collectArticleMedia(copy, true);
  copy.querySelectorAll([
    'button',
    '[role="button"]',
    'svg',
    'img',
    'video',
    'picture',
    'source',
    'script',
    'style',
    '[aria-hidden="true"]',
    '[data-testid="caret"]',
    '[data-testid="reply"]',
    '[data-testid="retweet"]',
    '[data-testid="like"]',
    '[data-testid="bookmark"]',
    '[data-testid="share"]'
  ].join(',')).forEach((element) => element.remove());

  const structuredBlocks = copy.querySelectorAll([
    '[class*="longform-unstyled"]',
    '[class*="longform-blockquote"]',
    '[class*="longform-header-"]',
    '[class*="longform-unordered-list-item"]',
    '[class*="longform-ordered-list-item"]',
    '[class*="longform-code"]',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'blockquote',
    'ul',
    'ol',
    'li',
    'pre',
    '[data-block]'
  ].join(','));

  const blocks = [];
  const seen = new Set();
  structuredBlocks.forEach((block) => {
    const markdown = getArticleBlockMarkdown(block);
    const key = markdown.replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    blocks.push(markdown);
  });

  let text = blocks.length
    ? normalizeArticleText(blocks.join('\n\n'))
    : normalizeArticleText(copy.innerText || copy.textContent);
  if (!text) text = normalizeArticleText(copy.innerText || copy.textContent);

  return { text, media };
}

function getMetaContent(selector) {
  const element = document.querySelector(selector);
  return element ? normalizeArticleText(element.getAttribute('content')) : '';
}

function extractArticleData() {
  const root = getArticleRoot();
  if (!root) return null;

  const titleElement = root.querySelector([
    '[data-testid="twitter-article-title"]',
    '[data-testid="twitterArticleTitle"]',
    'h1[role="heading"]',
    'h1',
    'h2'
  ].join(',')) || document.querySelector([
    '[data-testid="twitter-article-title"]',
    '[data-testid="twitterArticleTitle"]',
    'h1[role="heading"]',
    'h1'
  ].join(','));
  const authorElement = root.querySelector('[data-testid="User-Name"]') ||
    document.querySelector('[data-testid="User-Name"]');
  const timeElement = root.querySelector('time') || document.querySelector('time');
  const title = normalizeArticleText(
    titleElement?.innerText ||
    getMetaContent('meta[property="og:title"]') ||
    document.title.replace(/\s*[/|-]\s*X\s*$/i, '')
  );
  const author = normalizeArticleText(
    authorElement?.innerText || getMetaContent('meta[name="author"]')
  ).split('\n')[0];
  const extracted = getArticleText(root);
  const content = extracted.text;

  if (!content) return null;

  let body = content;
  if (title && body.toLowerCase().startsWith(title.toLowerCase())) {
    body = body.slice(title.length).trim();
  }

  return {
    title: title || 'X Article',
    author,
    publishedAt: normalizeArticleText(
      timeElement?.getAttribute('datetime') || timeElement?.innerText
    ),
    url: window.location.href.split('#')[0],
    content: body || content,
    media: extracted.media
  };
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
    } else if (request.action === "getArticleData") {
      const article = extractArticleData();
      if (article) {
        sendResponse({ status: "ok", article });
      } else {
        sendResponse({
          status: "error",
          message: "No readable X article was found on this page."
        });
      }
      return;
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
