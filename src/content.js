// Content script (simple version)
// Goal:
// 1) Open transcript panel
// 2) Read transcript lines from DOM
// 3) Return text to background script

const TRANSCRIPT_SEGMENT_SELECTOR =
  'ytd-engagement-panel-section-list-renderer[target-id*="transcript"] ytd-transcript-segment-renderer, ytd-transcript-segment-renderer';
const MENU_BUTTON_SELECTOR =
  "ytd-menu-renderer yt-button-shape button, ytd-menu-renderer button, ytd-watch-flexy #menu button";
const MENU_ITEM_SELECTOR =
  "ytd-menu-service-item-renderer, ytd-menu-navigation-item-renderer, tp-yt-paper-item";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(text) {
  return String(text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function hasKeyword(text, keywords) {
  const value = normalize(text);
  return keywords.some((keyword) => value.includes(normalize(keyword)));
}

function click(el) {
  if (!el) return false;
  el.click();
  return true;
}

function getElementText(el) {
  return `${el?.innerText || ""} ${el?.getAttribute?.("aria-label") || ""} ${el?.getAttribute?.("title") || ""}`;
}

function getVideoId() {
  return new URL(window.location.href).searchParams.get("v");
}

function getCourseName() {
  const channelName = document.querySelector("#channel-name a");
  const metaName = document.querySelector('meta[itemprop="author"]');
  return (channelName?.textContent || "").trim() || (metaName?.content || "").trim() || "Unknown Course";
}

function getLessonName() {
  const heading = document.querySelector("h1.ytd-watch-metadata");
  const titleNode = heading?.querySelector("yt-formatted-string");
  return (titleNode?.textContent || "").trim() || document.title.replace(" - YouTube", "").trim() || "Unknown Lesson";
}

// Read transcript rows and format each line as: "timestamp | text"
function getTranscriptLinesFromDom() {
  const nodes = Array.from(document.querySelectorAll(TRANSCRIPT_SEGMENT_SELECTOR));

  return nodes
    .map((node) => {
      const timeNode =
        node.querySelector("div.segment-timestamp") ||
        node.querySelector(".segment-timestamp") ||
        node.querySelector("#segment-timestamp");
      const textNode =
        node.querySelector("yt-formatted-string.segment-text") ||
        node.querySelector(".segment-text") ||
        node.querySelector("yt-formatted-string");

      const timestamp = (timeNode?.textContent || "").replace(/\s+/g, " ").trim();
      const text = (textNode?.textContent || "").replace(/\s+/g, " ").trim();
      if (!text) return "";
      return timestamp ? `${timestamp} | ${text}` : text;
    })
    .filter(Boolean);
}

function findMenuButton() {
  const candidates = Array.from(document.querySelectorAll(MENU_BUTTON_SELECTOR));
  return candidates.find((el) => hasKeyword(getElementText(el), ["more actions", "more"])) || null;
}

function findTranscriptMenuItem() {
  const candidates = Array.from(document.querySelectorAll(MENU_ITEM_SELECTOR));
  return candidates.find((el) => hasKeyword(getElementText(el), ["show transcript", "transcript"])) || null;
}

async function ensureTranscriptPanelOpen() {
  if (getTranscriptLinesFromDom().length > 0) return;

  // Sometimes transcript item is already visible.
  if (click(findTranscriptMenuItem())) {
    await wait(250);
    return;
  }

  // Normal path: click menu -> click transcript item.
  click(findMenuButton());
  await wait(250);
  click(findTranscriptMenuItem());
  await wait(350);
}

async function extractTranscriptText(maxAttempts, delayMs) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const lines = getTranscriptLinesFromDom();
    if (lines.length > 0) return lines.join("\n");

    await ensureTranscriptPanelOpen();
    await wait(delayMs);
  }
  return "";
}

async function extractSubtitlePayload() {
  const videoId = getVideoId();
  if (!videoId) throw new Error("No videoId found in URL");

  const subtitleText = await extractTranscriptText(12, 450);
  if (!subtitleText) throw new Error("Transcript not found. Open transcript manually and try again.");

  return {
    videoId,
    videoUrl: window.location.href,
    course: getCourseName(),
    lessonName: getLessonName(),
    languageCode: "dom",
    subtitleText,
    fetchedAt: new Date().toISOString(),
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXTRACT_SUBTITLES") return;

  (async () => {
    try {
      const payload = await extractSubtitlePayload();
      sendResponse({ ok: true, payload });
    } catch (error) {
      sendResponse({ ok: false, error: String(error) });
    }
  })();

  return true;
});
