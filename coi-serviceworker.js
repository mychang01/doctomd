/*! coi-serviceworker v0.1.7 - Guido Zuidhof, licensed under MIT */
/*
 * This service worker injects COOP/COEP headers for environments (like GitHub Pages)
 * that don't allow custom HTTP headers. This enables SharedArrayBuffer which Pyodide needs.
 *
 * Source: https://github.com/gzuidhof/coi-serviceworker
 */
if (typeof window === 'undefined') {
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

  self.addEventListener("fetch", function (e) {
    if (e.request.cache === "only-if-cached" && e.request.mode !== "same-origin") {
      return;
    }

    e.respondWith(
      fetch(e.request)
        .then(function (response) {
          if (response.status === 0) {
            return response;
          }

          const newHeaders = new Headers(response.headers);
          newHeaders.set("Cross-Origin-Embedder-Policy",
            e.request.mode === "navigate" ? "credentialless" : "require-corp"
          );
          if (e.request.mode === "navigate") {
            newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
          }

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        })
        .catch(function (e) {
          console.error(e);
        })
    );
  });

} else {
  (async function () {
    if (window.crossOriginIsolated !== false) return;

    const registration = await navigator.serviceWorker.register(window.document.currentScript.src).catch(function (e) {
      console.error("COOP/COEP Service Worker failed to register:", e);
    });
    if (registration) {
      console.log("COOP/COEP Service Worker registered. Reloading page to apply headers...");
      window.sessionStorage.setItem("coiReloadedBySW", "true");
      window.location.reload();
    }
  })();

  if (window.sessionStorage.getItem("coiReloadedBySW") === "true") {
    window.sessionStorage.removeItem("coiReloadedBySW");
    console.log("COOP/COEP headers applied via Service Worker.");
  }
}
