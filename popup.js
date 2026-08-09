document.addEventListener("DOMContentLoaded", () => {
  const focusToggle = document.getElementById("focusToggle");
  const zenToggle = document.getElementById("zenToggle");
  const wideToggle = document.getElementById("wideToggle");
  const markdownButton = document.getElementById("downloadMarkdown");
  const pdfButton = document.getElementById("downloadPdf");
  const statusText = document.getElementById("statusText");

  // Load current state from storage
  chrome.storage.sync.get(["focusModeEnabled", "zenModeEnabled", "wideModeEnabled"], (data) => {
    focusToggle.checked = data.focusModeEnabled || false;
    zenToggle.checked = data.zenModeEnabled || false;
    wideToggle.checked = data.wideModeEnabled || false;
  });

  focusToggle.addEventListener("change", (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.sync.set({ focusModeEnabled: isEnabled });
    void sendMessageToTab("toggleFocusMode", isEnabled);
  });

  wideToggle.addEventListener("change", (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.sync.set({ wideModeEnabled: isEnabled });
    void sendMessageToTab("toggleWideMode", isEnabled);
  });

  zenToggle.addEventListener("change", (e) => {
    const isEnabled = e.target.checked;
    chrome.storage.sync.set({ zenModeEnabled: isEnabled });
    void sendMessageToTab("toggleZenMode", isEnabled);
  });

  markdownButton.addEventListener("click", () => {
    void downloadArticle("md");
  });

  pdfButton.addEventListener("click", () => {
    void downloadArticle("pdf");
  });

  function isXUrl(url) {
    return typeof url === "string" && (url.includes("x.com") || url.includes("twitter.com"));
  }

  async function getActiveXTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || !isXUrl(tab.url)) {
      throw new Error("Open an X article first, then try again.");
    }
    return tab;
  }

  async function sendMessageToTab(action, enabled) {
    try {
      const tab = await getActiveXTab();
      await chrome.tabs.sendMessage(tab.id, { action, enabled });
    } catch (err) {
      console.log("Could not send message to tab, maybe not fully loaded.");
    }
  }

  async function requestArticleData() {
    const tab = await getActiveXTab();
    let response;

    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: "getArticleData" });
    } catch (err) {
      throw new Error("The X page is not ready yet. Refresh it and try again.");
    }

    if (!response || response.status !== "ok" || !response.article) {
      throw new Error(response?.message || "No readable X article was found on this page.");
    }

    return response.article;
  }

  async function downloadArticle(format) {
    setExportBusy(true);
    setStatus("Preparing article…");

    try {
      const article = await requestArticleData();
      const filenameBase = slugify(article.title || "x-article");
      const extension = format === "pdf" ? "pdf" : "md";
      const blob = format === "pdf"
        ? await createPdfBlob(article)
        : createMarkdownBlob(article);

      setStatus("Choose a save location in the Save As dialog…");
      await downloadBlob(blob, `${filenameBase}.${extension}`);
      setStatus("Save As dialog opened. Choose a location and click Save.", "success");
    } catch (err) {
      setStatus(err.message || "Could not download the article.", "error");
    } finally {
      setExportBusy(false);
    }
  }

  function setExportBusy(isBusy) {
    markdownButton.disabled = isBusy;
    pdfButton.disabled = isBusy;
  }

  function setStatus(message, state) {
    statusText.textContent = message;
    statusText.className = state || "";
  }

  function slugify(value) {
    return value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "x-article";
  }

  function escapeMarkdown(value) {
    return String(value || "").replace(/[\\`*_{}\[\]()<>#+.!|]/g, "\\$&");
  }

  function escapeHtmlAttribute(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function renderMarkdownMedia(media) {
    if (!media) return "";
    if (media.kind === "image") {
      return `![${escapeMarkdown(media.alt || "Article image")}](${media.url})`;
    }

    const isDirectMp4 = /^https?:\/\/video\.twimg\.com\//i.test(media.url || "") &&
      /\.mp4(?:[?#]|$)/i.test(media.url || "");
    const videoPlayer = isDirectMp4
      ? `<video controls preload="metadata" src="${escapeHtmlAttribute(media.url)}"></video>`
      : "";
    let videoLinks = isDirectMp4
      ? `[Open video file](${media.url})`
      : "";
    if (media.openUrl) videoLinks += `${videoLinks ? " · " : ""}[Open video in X](${media.openUrl})`;
    const videoLink = videoLinks || "Video clip is available in the original article.";
    const thumbnail = media.poster
      ? `![Video thumbnail](${media.poster})`
      : "";
    return [videoPlayer, videoLink, thumbnail].filter(Boolean).join("\n\n");
  }

  function renderMarkdownBody(article) {
    const media = article.media || [];
    const markers = new Set();
    const body = String(article.content || "").replace(
      /\[\[XFM_MEDIA_(\d+)\]\]/g,
      (_match, indexText) => {
        const index = Number(indexText);
        markers.add(index);
        return renderMarkdownMedia(media[index]);
      }
    );
    const unplacedMedia = media
      .filter((_item, index) => !markers.has(index))
      .map(renderMarkdownMedia)
      .filter(Boolean);

    return [body.trim(), ...unplacedMedia].filter(Boolean).join("\n\n");
  }

  function createMarkdownBlob(article) {
    const metadata = [
      article.author ? `**Author:** ${escapeMarkdown(article.author)}` : "",
      article.publishedAt ? `**Published:** ${escapeMarkdown(article.publishedAt)}` : "",
      article.url ? `**Source:** ${article.url}` : ""
    ].filter(Boolean);
    const markdown = [
      `# ${escapeMarkdown(article.title || "X Article")}`,
      "",
      ...metadata,
      "",
      renderMarkdownBody(article),
      "",
      "---",
      "Exported from X Focus Mode."
    ].join("\n");

    return new Blob([`${markdown}\n`], { type: "text/markdown;charset=utf-8" });
  }

  async function downloadBlob(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);

    try {
      const downloadId = await chrome.downloads.download({
        url: objectUrl,
        filename,
        saveAs: true,
        conflictAction: "prompt"
      });

      if (!downloadId) throw new Error("Chrome did not create a download.");

      // The Save As dialog can outlive this popup. Keep the source URL alive
      // long enough for Chrome to finish copying it, without waiting on a
      // downloads.onChanged event that may be lost with the popup context.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      return downloadId;
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      throw new Error(err?.message || "Chrome could not start the download.");
    }
  }

  function sanitizePdfText(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...")
      .replace(/•/g, "*")
      .replace(/[^\x20-\x7E]/g, "?");
  }

  function wrapPdfText(value, maxChars) {
    return String(value || "").split(/\r?\n/).flatMap((rawLine) => {
      const line = rawLine.trim();
      if (!line) return [""];

      const words = line.split(/\s+/);
      const lines = [];
      let current = "";

      words.forEach((word) => {
        if (word.length > maxChars) {
          if (current) {
            lines.push(current);
            current = "";
          }
          for (let index = 0; index < word.length; index += maxChars) {
            lines.push(word.slice(index, index + maxChars));
          }
          return;
        }

        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > maxChars) {
          lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      });

      if (current) lines.push(current);
      return lines;
    });
  }

  function escapePdfText(value) {
    return sanitizePdfText(value)
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  }

  function stripMarkdownForPdf(value) {
    return String(value || "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^>\s?/gm, "");
  }

  function plainPdfText(value) {
    return stripMarkdownForPdf(value)
      .replace(/^```[^\n]*$/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
      .replace(/`([^`]+)`/g, "$1");
  }

  function addPdfBlock(items, value, size, leading, maxChars) {
    const lines = wrapPdfText(value, maxChars);
    lines.forEach((text) => {
      items.push({ type: "text", text, size, leading });
    });
    items.push({ type: "text", text: "", size: 11, leading: 9 });
  }

  function addPdfContent(items, value, preparedMedia) {
    const parts = String(value || "").split(/\[\[XFM_MEDIA_(\d+)\]\]/g);
    for (let index = 0; index < parts.length; index += 1) {
      if (index % 2 === 0) {
        addPdfFormattedText(items, parts[index]);
      } else {
        addPdfMedia(items, preparedMedia[Number(parts[index])]);
      }
    }
  }

  function addPdfFormattedText(items, value) {
    let inCodeBlock = false;
    let paragraph = [];

    const flushParagraph = () => {
      if (!paragraph.length) return;
      addPdfBlock(items, plainPdfText(paragraph.join(" ")), 11, 16, 92);
      paragraph = [];
    };

    String(value || "").split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("```")) {
        flushParagraph();
        inCodeBlock = !inCodeBlock;
        return;
      }
      if (inCodeBlock) {
        const codeLines = wrapPdfText(line, 84);
        codeLines.forEach((codeLine) => {
          items.push({ type: "code", text: codeLine, size: 9, leading: 13 });
        });
        return;
      }
      if (!trimmed) {
        flushParagraph();
        return;
      }
      const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        const size = Math.max(12, 18 - heading[1].length);
        addPdfBlock(items, plainPdfText(heading[2]), size, size + 6, 78);
        return;
      }
      if (/^(?:[-*]|\d+\.)\s+/.test(trimmed) || /^>\s?/.test(trimmed)) {
        flushParagraph();
        addPdfBlock(items, plainPdfText(trimmed), 11, 16, 92);
        return;
      }
      paragraph.push(trimmed);
    });

    flushParagraph();
  }

  function addPdfMedia(items, media) {
    if (!media) return;
    if (media.pdfImage) {
      items.push({ type: "image", image: media.pdfImage, media });
    }
    const source = media.url || media.poster;
    if (source) {
      addPdfBlock(
        items,
        `${media.kind === "video" ? "Video clip" : "Image"}: ${source}`,
        8,
        11,
        115
      );
    }
  }

  async function createPdfBlob(article) {
    const preparedMedia = await preparePdfMedia(article.media || []);
    const items = [];

    addPdfBlock(items, article.title || "X Article", 18, 24, 62);
    if (article.author) addPdfBlock(items, `By ${article.author}`, 10, 14, 100);
    if (article.publishedAt) addPdfBlock(items, `Published: ${article.publishedAt}`, 10, 14, 100);
    if (article.url) addPdfBlock(items, `Source: ${article.url}`, 9, 13, 108);
    addPdfContent(items, article.content, preparedMedia);

    const pages = paginatePdfItems(items);
    return new Blob([buildPdfDocument(pages)], { type: "application/pdf" });
  }

  async function preparePdfMedia(media) {
    return Promise.all(media.map(async (item, index) => {
      const prepared = { ...item, index, pdfImage: null };
      const imageUrl = item.kind === "video" ? item.poster : item.url;
      if (!imageUrl) return prepared;

      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeoutId = setTimeout(() => controller?.abort(), 15_000);
      try {
        const response = await fetch(imageUrl, {
          credentials: "omit",
          ...(controller ? { signal: controller.signal } : {})
        });
        if (!response.ok) return prepared;
        const contentLength = Number(response.headers.get("content-length") || 0);
        if (contentLength > 12 * 1024 * 1024) return prepared;

        const blob = await response.blob();
        if (blob.size > 12 * 1024 * 1024) return prepared;
        const bitmap = await createImageBitmap(blob);
        const bitmapWidth = bitmap.width;
        const bitmapHeight = bitmap.height;
        const displayScale = Math.min(1, 487 / bitmapWidth, 260 / bitmapHeight);
        const embedScale = Math.min(1, 1200 / bitmapWidth, 900 / bitmapHeight);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmapWidth * embedScale));
        canvas.height = Math.max(1, Math.round(bitmapHeight * embedScale));
        const context = canvas.getContext("2d");
        if (!context) return prepared;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();

        const base64 = canvas.toDataURL("image/jpeg", 0.95).split(",")[1];
        prepared.pdfImage = {
          key: `media-${index}`,
          bytes: base64ToBytes(base64),
          width: Math.max(1, Math.round(bitmapWidth * displayScale)),
          height: Math.max(1, Math.round(bitmapHeight * displayScale)),
          pixelWidth: canvas.width,
          pixelHeight: canvas.height
        };
      } catch (err) {
        console.log("Could not embed article media in PDF.", err);
      } finally {
        clearTimeout(timeoutId);
      }
      return prepared;
    }));
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function paginatePdfItems(items) {
    const pages = [[]];
    let y = 788;
    items.forEach((item) => {
      if (item.type === "image") {
        const height = item.image.height;
        if (y - height < 54) {
          pages.push([]);
          y = 788;
        }
        pages[pages.length - 1].push({
          ...item,
          x: 54,
          y: y - height,
          width: item.image.width,
          height
        });
        y -= height + 12;
        return;
      }

      if (y - item.leading < 54) {
        pages.push([]);
        y = 788;
      }
      pages[pages.length - 1].push({ ...item, y });
      y -= item.leading;
    });
    return pages;
  }

  function bytesToHex(bytes) {
    let hex = "";
    bytes.forEach((byte) => {
      hex += byte.toString(16).padStart(2, "0");
    });
    return `${hex}>`;
  }

  function buildPdfDocument(pages) {
    const objects = [];
    const pageObjectNumbers = [];
    const embeddedImages = [];
    const imageRefs = new Map();
    const fontObjectNumber = 3 + pages.length * 2;
    const codeFontObjectNumber = fontObjectNumber + 1;

    pages.flat().forEach((item) => {
      if (item.type !== "image" || imageRefs.has(item.image.key)) return;
      const reference = {
        name: `Im${embeddedImages.length + 1}`,
        objectNumber: fontObjectNumber + 2 + embeddedImages.length
      };
      imageRefs.set(item.image.key, reference);
      embeddedImages.push(item.image);
    });

    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = "";

    pages.forEach((page) => {
      const pageObjectNumber = objects.length;
      const contentObjectNumber = pageObjectNumber + 1;
      pageObjectNumbers.push(pageObjectNumber);
      const xObjectResources = embeddedImages.length
        ? `/XObject << ${embeddedImages.map((image, index) => `/Im${index + 1} ${fontObjectNumber + 2 + index} 0 R`).join(" ")} >>`
        : "";

      const stream = [
        "BT",
        ...page.flatMap((item) => {
          if (item.type === "image") {
            const reference = imageRefs.get(item.image.key);
            return [
              "ET",
              "q",
              `${item.width} 0 0 ${item.height} ${item.x} ${item.y} cm`,
              `/${reference.name} Do`,
              "Q",
              "BT"
            ];
          }
          if (item.type === "code") {
            return [
              "ET",
              "q",
              "0.94 0.94 0.94 rg",
              `54 ${item.y - 4} 487 ${item.leading + 2} re`,
              "f",
              "Q",
              "BT",
              "0 0 0 rg",
              `/F2 ${item.size} Tf`,
              `1 0 0 1 60 ${item.y} Tm`,
              `(${escapePdfText(item.text)}) Tj`
            ];
          }
          return item.text ? [
            "0 0 0 rg",
            `/F1 ${item.size} Tf`,
            `1 0 0 1 54 ${item.y} Tm`,
            `(${escapePdfText(item.text)}) Tj`
          ] : [];
        }),
        "ET"
      ].join("\n");

      objects[pageObjectNumber] = [
        "<< /Type /Page /Parent 2 0 R",
        "/MediaBox [0 0 595 842]",
        `/Resources << /Font << /F1 ${fontObjectNumber} 0 R /F2 ${codeFontObjectNumber} 0 R >> ${xObjectResources} >>`,
        `/Contents ${contentObjectNumber} 0 R >>`
      ].join(" ");
      objects[contentObjectNumber] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });

    objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pages.length} >>`;
    objects[fontObjectNumber] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
    objects[codeFontObjectNumber] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";
    embeddedImages.forEach((image, index) => {
      const data = bytesToHex(image.bytes);
      const objectNumber = fontObjectNumber + 2 + index;
      objects[objectNumber] = [
        `<< /Type /XObject /Subtype /Image /Width ${image.pixelWidth || image.width} /Height ${image.pixelHeight || image.height}`,
        "/ColorSpace /DeviceRGB /BitsPerComponent 8",
        "/Filter [/ASCIIHexDecode /DCTDecode]",
        `/Length ${data.length} >>\nstream\n${data}\nendstream`
      ].join(" ");
    });

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (let index = 1; index < objects.length; index += 1) {
      offsets[index] = pdf.length;
      pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
    }

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let index = 1; index < objects.length; index += 1) {
      pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return pdf;
  }
});
