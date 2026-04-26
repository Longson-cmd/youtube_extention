<script setup>
// Practice file:
// Retype your popup logic here.
// Suggested order:
// 1) state + loading
// 2) setState
// 3) requestState
// 4) importNow
// 5) handleStorageChanged
// 6) onMounted / onUnmounted

import { onMounted, onUnmounted, ref } from "vue";
const loading = ref(false);
const message = ref("Click Import to send subtitles.");

const importNow = async () => {
  loading.value = true;
  message.value = 'Importing'

  try {
    const res = await chrome.runtime.sendMessage({ type: "IMPORT_SUBTITLES" })
    message.value = res?.ok ? "Import success." : `Import failed: ${res?.error || "Unknown error"}`;
  }
  finally {
    loading.value = false
  }
}

</script>

<template>
  <main class="w-80 bg-slate-50 p-4 text-slate-900">
    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 class="text-base font-semibold">YouTube Subtitle Extractor</h1>

      <button
        class="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        :disabled="loading"
        @click="importNow"
      >
        {{ loading ? "Importing..." : "Import" }}
      </button>

      <p class="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
        {{ message }}
      </p>
    </section>
  </main>
</template>

