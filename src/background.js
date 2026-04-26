import { importSubtitles } from "./background/subtitles.js";

// Single MV3 background entry with routing only.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("SW got message:", message?.type);
  if (message?.type !== "IMPORT_SUBTITLES") return;

  (async () => {
    try {
      sendResponse(await importSubtitles(message?.access, message?.refresh));
    } catch (error) {
      sendResponse({ ok: false, error: String(error) });
    }
  })();

  return true;
});
