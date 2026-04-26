
<template>
  <main class="w-80 bg-slate-50 p-4 text-slate-900">
    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 class="text-base font-semibold">YouTube Subtitle Extractor</h1>

      <div class="mt-3 space-y-2 text-sm">
        <p><span class="font-medium">Course:</span> {{ state.course }}</p>
        <p><span class="font-medium">Lesson Name:</span> {{ state.lessonName }}</p>
      </div>

      <button
        class="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        :disabled="loading"
        @click="importNow"
      >
        {{ loading ? "Importing..." : "Import" }}
      </button>

      <p class="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
        {{ state.message }}
      </p>

      <div v-if="state.subtitlePreview.length" class="mt-3 rounded-lg bg-slate-100 px-3 py-2">
        <p class="text-xs font-medium text-slate-700">First 5 subtitle lines:</p>
        <ol class="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-700">
          <li v-for="(line, index) in state.subtitlePreview" :key="`${index}-${line}`">
            {{ line }}
          </li>
        </ol>
      </div>
    </section>
  </main>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from "vue";

const state = ref({
  course: "",
  lessonName: "",
  message: "Waiting for subtitle data...",
  subtitlePreview: [],
});

const loading = ref(false);
</script>
