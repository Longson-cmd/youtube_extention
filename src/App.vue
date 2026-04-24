<template>
  <router-view />
</template>

<!-- 
Core pipeline is there, but production-ready pieces are still missing.

Already done:

Content script extracts subtitles
Background sends to backend
Extension builds and loads
Still needed:

Handle YouTube SPA navigation (watch changes without full reload)
Prevent duplicate sends for same video
Better subtitle language selection and fallback
Robust error reporting/retry in background
Backend auth/token (so endpoint isn’t open)
Optional Vue popup UI for status + manual resend
Privacy controls (only send on user action, if required)
So: MVP works, but not complete-hardened yet. -->