// Background script (simple version)
// Goal:
// 1) Ask content script to extract subtitles
// 2) Show preview in popup state
// 3) Send payload to backend

const POPUP_STATE_KEY = "popup_state";
const BACKEND_URL = "http://localhost:8000/api/subtitles";

const defaultPopupState = {
  course: "-",
  lessonName: "-",
  message: "Ready. Click Import on a YouTube lesson page.",
  subtitlePreview: [],
  lastUpdated: new Date(0).toISOString(),
};

function firstFiveLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
}

async function readPopupState() {
  const stored = (await chrome.storage.local.get(POPUP_STATE_KEY))[POPUP_STATE_KEY];
  return stored || defaultPopupState;
}

async function setPopupState(next) {
  const current = await readPopupState();
  const merged = {
    ...current,
    ...(next || {}),
    lastUpdated: new Date().toISOString(),
  };
  await chrome.storage.local.set({ [POPUP_STATE_KEY]: merged });
}

async function getActiveYoutubeTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const active = tabs[0];
  if (!active?.id) throw new Error("No active tab found");
  if (!String(active.url || "").includes("youtube.com/watch")) {
    throw new Error("Open a YouTube watch page first");
  }
  return active.id;
}

// Try to message content script. If missing, inject content.js once and retry.
async function sendToContent(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    if (!String(error).includes("Receiving end does not exist")) throw error;

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    return await chrome.tabs.sendMessage(tabId, message);
  }
}

async function importFromActiveTab() {
  await setPopupState({ message: "Extracting subtitles..." });

  const tabId = await getActiveYoutubeTabId();
  const extraction = await sendToContent(tabId, { type: "EXTRACT_SUBTITLES" });

  if (!extraction) throw new Error("No response from content script");
  if (!extraction.ok) throw new Error(extraction.error || "Subtitle extraction failed");

  const payload = extraction.payload;
  const subtitlePreview = firstFiveLines(payload.subtitleText);

  await setPopupState({
    course: payload.course,
    lessonName: payload.lessonName,
    subtitlePreview,
    message: "Subtitles extracted. Sending to backend...",
  });

  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);

    await setPopupState({
      course: payload.course,
      lessonName: payload.lessonName,
      subtitlePreview,
      message: `Import success for ${payload.videoId}`,
    });
    return { ok: true, state: await readPopupState() };
  } catch (error) {
    await setPopupState({
      course: payload.course,
      lessonName: payload.lessonName,
      subtitlePreview,
      message: `Backend send failed: ${String(error)}`,
    });
    return { ok: false, error: String(error), state: await readPopupState() };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ [POPUP_STATE_KEY]: defaultPopupState });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_POPUP_STATE") {
    (async () => sendResponse({ ok: true, state: await readPopupState() }))();
    return true;
  }

  if (message?.type === "IMPORT_SUBTITLES") {
    (async () => {
      try {
        sendResponse(await importFromActiveTab());
      } catch (error) {
        await setPopupState({ message: `Import failed: ${String(error)}` });
        sendResponse({ ok: false, error: String(error), state: await readPopupState() });
      }
    })();
    return true;
  }
});
