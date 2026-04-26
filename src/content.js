const SEGMENT_SELECTOR =
  'ytd-engagement-panel-section-list-renderer[target-id*="transcript"] ytd-transcript-segment-renderer, ytd-transcript-segment-renderer';

const MENU_BUTTON_SELECTOR =
  "ytd-menu-renderer yt-button-shape button, ytd-menu-renderer button, ytd-watch-flexy #menu button";

const MENU_ITEM_SELECTOR =
  "ytd-menu-service-item-renderer, ytd-menu-navigation-item-renderer, tp-yt-paper-item";

function dbg(...args) {
  console.log("[subtitle-debug]", ...args);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findByKeyword(selector, keywords) {
  const items = Array.from(document.querySelectorAll(selector));
  return (
    items.find((el) => {
      const text = `${el?.innerText || ""} ${el?.getAttribute?.("aria-label") || ""} ${el?.getAttribute?.("title") || ""}`
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      return keywords.some((keyword) => text.includes(keyword));
    }) || null
  );
}

function getLinesFromTranscriptPanel() {
  return Array.from(document.querySelectorAll(SEGMENT_SELECTOR))
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

async function readTranscriptPanelText() {
  dbg("UI transcript path: start");
  for (let i = 0; i < 12; i += 1) {
    const lines = getLinesFromTranscriptPanel();
    dbg("UI transcript path: attempt", i + 1, "lines:", lines.length);
    if (lines.length) return lines.join("\n");

    const transcriptItem = findByKeyword(MENU_ITEM_SELECTOR, ["show transcript", "transcript"]);
    if (transcriptItem) {
      dbg("UI transcript path: found transcript menu item, clicking");
      transcriptItem.click();
      await sleep(250);
    } else {
      dbg("UI transcript path: transcript item not found, opening more menu");
      findByKeyword(MENU_BUTTON_SELECTOR, ["more actions", "more"])?.click();
      await sleep(250);
      findByKeyword(MENU_ITEM_SELECTOR, ["show transcript", "transcript"])?.click();
      await sleep(350);
    }

    await sleep(450);
  }

  return "";
}

function formatTimestamp(ms) {
  const totalSec = Math.floor(ms / 1000);
  const hour = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (hour > 0) return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function extractJsonObjectAfter(text, marker) {
  const startMarker = text.indexOf(marker);
  if (startMarker === -1) return null;

  const jsonStart = text.indexOf("{", startMarker);
  if (jsonStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = jsonStart; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const jsonText = text.slice(jsonStart, i + 1);
        try {
          return JSON.parse(jsonText);
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function getPlayerResponseFromPageScripts() {
  const scripts = Array.from(document.scripts);
  dbg("Fallback path: scanning scripts for ytInitialPlayerResponse, script count:", scripts.length);
  for (const script of scripts) {
    const text = script.textContent || "";
    if (!text) continue;

    let parsed = extractJsonObjectAfter(text, "ytInitialPlayerResponse =");
    if (parsed) return parsed;

    parsed = extractJsonObjectAfter(text, "var ytInitialPlayerResponse =");
    if (parsed) return parsed;

    parsed = extractJsonObjectAfter(text, "window['ytInitialPlayerResponse'] =");
    if (parsed) return parsed;
  }
  return null;
}

function pickCaptionTrack(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;

  const preferred =
    tracks.find((t) => (t?.languageCode || "").toLowerCase().startsWith("en")) ||
    tracks.find((t) => t?.kind !== "asr") ||
    tracks[0];

  return preferred || null;
}

async function getSubtitleTextFromTrackBaseUrl(baseUrl) {
  const jsonUrl = baseUrl.includes("fmt=") ? baseUrl : `${baseUrl}&fmt=json3`;
  dbg("Fallback path: fetching caption JSON", jsonUrl.slice(0, 160));
  const res = await fetch(jsonUrl, { credentials: "include" });
  dbg("Fallback path: caption fetch status", res.status);
  if (!res.ok) throw new Error(`Caption fetch failed (${res.status})`);

  const data = await res.json().catch(() => null);
  const events = Array.isArray(data?.events) ? data.events : [];
  dbg("Fallback path: caption events count", events.length);
  const lines = [];

  for (const event of events) {
    const parts = Array.isArray(event?.segs) ? event.segs.map((seg) => seg?.utf8 || "").join("") : "";
    const text = parts.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const ts = formatTimestamp(Number(event?.tStartMs || 0));
    lines.push(`${ts} | ${text}`);
  }

  return lines.join("\n").trim();
}

async function readTranscriptFromCaptionsApi() {
  dbg("Fallback path: start");
  const playerResponse = getPlayerResponseFromPageScripts();
  const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  dbg("Fallback path: caption tracks count", Array.isArray(tracks) ? tracks.length : 0);
  const track = pickCaptionTrack(tracks);
  dbg("Fallback path: chosen track", track?.languageCode || "none", track?.kind || "n/a");
  if (!track?.baseUrl) return "";

  try {
    return await getSubtitleTextFromTrackBaseUrl(track.baseUrl);
  } catch {
    dbg("Fallback path: caption fetch/parse failed");
    return "";
  }
}

async function extractSubtitlePayload() {
  const videoId = new URL(window.location.href).searchParams.get("v");
  if (!videoId) throw new Error("No videoId found in URL");
  dbg("Extract start, videoId:", videoId);

  let subtitleText = await readTranscriptPanelText();
  dbg("UI transcript result length:", subtitleText.length);
  if (!subtitleText) {
    dbg("Trying fallback captions API path");
    subtitleText = await readTranscriptFromCaptionsApi();
    dbg("Fallback result length:", subtitleText.length);
  }

  if (!subtitleText) throw new Error("Transcript not found. Try enabling captions and opening transcript once.");

  return {
    videoId,
    subtitleText,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "EXTRACT_SUBTITLES") return;
  dbg("Received message", message?.type);

  (async () => {
    try {
      sendResponse({ ok: true, payload: await extractSubtitlePayload() });
    } catch (error) {
      dbg("Extraction failed", String(error));
      sendResponse({ ok: false, error: String(error) });
    }
  })();

  return true;
});
