import { API_ENDPOINTS } from "../config/api.js";
import { refreshAccessToken } from "./auth.js";

async function getActiveYoutubeTabId() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!active?.id) throw new Error("No active tab found");
  if (!String(active.url || "").includes("youtube.com/watch")) {
    throw new Error("Open a YouTube watch page first");
  }

  return active.id;
}

async function extractFromContent(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_SUBTITLES" });
  } catch (error) {
    if (!String(error).includes("Receiving end does not exist")) throw error;

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });

    return await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_SUBTITLES" });
  }
}

async function postSubtitles(payload, accessToken) {
  return fetch(API_ENDPOINTS.subtitles, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function importSubtitles(accessToken, refreshToken) {
  if (!accessToken) throw new Error("Missing access token. Please login first.");

  const tabId = await getActiveYoutubeTabId();
  const extraction = await extractFromContent(tabId);
  console.log('extraction', extraction);

  if (!extraction) throw new Error("No response from content script");
  if (!extraction.ok) throw new Error(extraction.error || "Subtitle extraction failed");

  let res = await postSubtitles(extraction.payload, accessToken);
  let newAccess = null;

  if (res.status === 401 && refreshToken) {
    newAccess = await refreshAccessToken(refreshToken);
    res = await postSubtitles(extraction.payload, newAccess);
  }

  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return { ok: true, newAccess };
}
