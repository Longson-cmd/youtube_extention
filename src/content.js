const SEGMENT_SELECTOR = [
  'ytd-engagement-panel-section-list-renderer[target-id*="transcript"] ytd-transcript-segment-renderer',
  "ytd-transcript-segment-renderer",
  'ytd-engagement-panel-section-list-renderer[target-id*="transcript"] transcript-segment-view-model',
  "transcript-segment-view-model",
].join(", ");
const TRANSCRIPT_CHIP_SELECTOR = "button.ytChipShapeButtonReset";
const MENU_ITEM_SELECTOR = [
  "ytd-menu-service-item-renderer",
  "ytd-menu-navigation-item-renderer",
  "tp-yt-paper-item",
].join(", ");
const MORE_MENU_SELECTOR = [
  "ytd-menu-renderer button",
  "ytd-watch-metadata #menu button",
  "ytd-watch-flexy #menu button",
].join(", ");

const DEBUG_PREFIX = "[YT Subtitle Extractor]";
const TRANSCRIPT_KEYWORDS = ["show transcript", "transcript", "ban chep loi", "hien ban chep loi"];
const CLOSE_KEYWORDS = ["close transcript", "dong ban chep loi"];
const MORE_KEYWORDS = ["more actions", "more", "them", "tac vu khac", "hanh dong khac"];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getNodeText(node) {
  return normalizeText(
    `${node?.innerText || ""} ${node?.getAttribute?.("aria-label") || ""} ${node?.getAttribute?.("title") || ""}`
  );
}

function hasAnyKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function findByKeyword(selector, keywords, excludedKeywords = []) {
  const nodes = Array.from(document.querySelectorAll(selector));
  return (
    nodes.find((node) => {
      const text = getNodeText(node);
      return hasAnyKeyword(text, keywords) && !hasAnyKeyword(text, excludedKeywords);
    }) || null
  );
}

function getSubtitleLinesFromPanel() {
  return Array.from(document.querySelectorAll(SEGMENT_SELECTOR))
    .map((segment) => {
      const timestamp = (
        segment.querySelector(
          ".segment-timestamp, #segment-timestamp, .ytwTranscriptSegmentViewModelTimestamp"
        )?.textContent || ""
      )
        .replace(/\s+/g, " ")
        .trim();
      const text = (
        segment.querySelector(
          ".segment-text, yt-formatted-string.segment-text, span.ytAttributedStringHost, [role='text']"
        )?.textContent || ""
      )
        .replace(/\s+/g, " ")
        .trim();
      if (!text) return "";
      return timestamp ? `${timestamp} | ${text}` : text;
    })
    .filter(Boolean);
}

function findTranscriptChip() {
  return findByKeyword(TRANSCRIPT_CHIP_SELECTOR, TRANSCRIPT_KEYWORDS, CLOSE_KEYWORDS);
}

async function ensureTranscriptIsOpen() {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (getSubtitleLinesFromPanel().length) return true;

    const chip = findTranscriptChip();
    if (chip) {
      console.log(`${DEBUG_PREFIX} Click transcript chip (attempt ${attempt}).`);
      chip.click();
      await sleep(700);
      if (getSubtitleLinesFromPanel().length) return true;
    }

    const moreButton = findByKeyword(MORE_MENU_SELECTOR, MORE_KEYWORDS);
    if (moreButton) {
      console.log(`${DEBUG_PREFIX} Open more menu (attempt ${attempt}).`);
      moreButton.click();
      await sleep(300);
    }

    const menuItem = findByKeyword(MENU_ITEM_SELECTOR, TRANSCRIPT_KEYWORDS, CLOSE_KEYWORDS);
    if (menuItem) {
      console.log(`${DEBUG_PREFIX} Click transcript menu item (attempt ${attempt}).`);
      menuItem.click();
    } else {
      console.log(`${DEBUG_PREFIX} Transcript button/menu item not found (attempt ${attempt}).`);
    }

    await sleep(700);
  }
  return false;
}

function readVideoMeta() {
  const url = new URL(window.location.href);
  const videoId = url.searchParams.get("v");
  if (!videoId) throw new Error("No videoId found in URL");

  const lessonName =
    document.querySelector("h1.ytd-watch-metadata yt-formatted-string")?.textContent?.trim() ||
    document.title.replace(" - YouTube", "").trim() ||
    "-";

  const course =
    document.querySelector("ytd-channel-name a")?.textContent?.trim() ||
    document.querySelector("#owner #channel-name a")?.textContent?.trim() ||
    "-";

  return { videoId, lessonName, course };
}

async function extractSubtitlePayload() {
  await ensureTranscriptIsOpen();
  const lines = getSubtitleLinesFromPanel();

  if (!lines.length) {
    throw new Error("Transcript not found. Open a video that has transcript.");
  }

  console.log(`${DEBUG_PREFIX} First 3 subtitle lines:`);
  lines.slice(0, 3).forEach((line, index) => {
    console.log(`${DEBUG_PREFIX} ${index + 1}. ${line}`);
  });

  const { videoId, lessonName, course } = readVideoMeta();
  return {
    videoId,
    lessonName,
    course,
    subtitleText: lines.join("\n"),
  };
}

function setupMessageListener() {
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
}

if (!window.__YT_SUBTITLE_EXTRACTOR_INSTALLED__) {
  window.__YT_SUBTITLE_EXTRACTOR_INSTALLED__ = true;
  setupMessageListener();
  console.log(`${DEBUG_PREFIX} content script loaded`);
}

// timestamp: .ytwTranscriptSegmentViewModelTimestamp
// text: span.ytAttributedStringHost