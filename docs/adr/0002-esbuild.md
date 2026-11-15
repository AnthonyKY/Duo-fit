# ADR 0002 — esbuild instead of Vite for apps/web

Status: accepted (14 Nov 2026). Vite remains an option: the sources are plain TypeScript/React modules.

esbuild gives a one-file build script (apps/web/scripts/build.mjs), a strict Content-Security-Policy generated at build
time (no inline code), and builds in well under a second. It also runs in the development environment used by the agents,
where Vite is not available offline. Switching to Vite later only means adding its config; no source change.
