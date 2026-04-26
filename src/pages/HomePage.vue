<script setup>
import { onMounted, ref } from "vue";
import { API_ENDPOINTS } from "../config/api.js";

const AUTH_STORAGE_KEY = "auth";

const loginLoading = ref(false);
const importLoading = ref(false);
const email = ref("test@example.com");
const password = ref("1234abcd");
const message = ref("Sign in, then click Import to send subtitles.");
const auth = ref(null);

onMounted(async () => {
  const data = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  if (data?.[AUTH_STORAGE_KEY]) {
    auth.value = data[AUTH_STORAGE_KEY];
    message.value = "Signed in. Ready to import.";
  }
});

async function login() {
  if (!email.value.trim() || !password.value) {
    message.value = "Email and password are required.";
    return;
  }

  loginLoading.value = true;
  message.value = "Signing in...";
  console.log("Attempting login with email:", email.value);
  try {
    const res = await fetch(API_ENDPOINTS.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.value.trim(),
        password: password.value,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      message.value = data?.message || `Login failed (${res.status})`;
      return;
    }

    auth.value = {
      access: data.access,
      refresh: data.refresh,
      user: data.user,
    };
    await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: auth.value });
    password.value = "";
    message.value = "Login success.";
  } catch (error) {
    message.value = `Login failed: ${String(error)}`;
  } finally {
    loginLoading.value = false;
  }
}

async function logout() {
  await chrome.storage.local.remove(AUTH_STORAGE_KEY);
  auth.value = null;
  password.value = "";
  message.value = "Logged out.";
}

async function importNow() {
  if (!auth.value?.access) {
    message.value = "Please login first.";
    return;
  }

  importLoading.value = true;
  message.value = "Importing...";
  try {
    const res = await chrome.runtime.sendMessage({
      type: "IMPORT_SUBTITLES",
      access: auth.value.access,
      refresh: auth.value.refresh,
    });

    if (res?.newAccess && auth.value) {
      auth.value = { ...auth.value, access: res.newAccess };
      await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: auth.value });
    }

    message.value = res?.ok ? "Import success." : `Import failed: ${res?.error || "Unknown error"}`;
  } finally {
    importLoading.value = false;
  }
}
</script>

<template>
  <main class="w-80 bg-slate-50 p-4 text-slate-900">
    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h1 class="text-base font-semibold">YouTube Subtitle Extractor</h1>

      <template v-if="!auth?.access">
        <label class="mt-4 block text-xs font-medium text-slate-700">Email</label>
        <input
          v-model="email"
          type="email"
          class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          placeholder="you@example.com"
        />

        <label class="mt-3 block text-xs font-medium text-slate-700">Password</label>
        <input
          v-model="password"
          type="password"
          class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          placeholder="Password"
        />

        <button
          class="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          :disabled="loginLoading"
          @click="login"
        >
          {{ loginLoading ? "Signing in..." : "Login" }}
        </button>
      </template>

      <template v-else>
        <p class="mt-3 text-xs text-slate-600">
          Signed in as <span class="font-medium text-slate-900">{{ auth.user?.email || "Unknown user" }}</span>
        </p>

        <button
          class="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          :disabled="importLoading"
          @click="importNow"
        >
          {{ importLoading ? "Importing..." : "Import" }}
        </button>

        <button
          class="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          @click="logout"
        >
          Logout
        </button>
      </template>

      <p class="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
        {{ message }}
      </p>
    </section>
  </main>
</template>
