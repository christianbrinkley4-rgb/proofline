// Runs on Proofline's own app pages. Everywhere there, it tells the extension
// that facts may be changing, so fit scores cached for job sites are dropped.
// On the Connect page it also tells the page the extension is here, and passes
// the token the page creates to the extension's storage. The token is never
// shown on screen.
(() => {
  const origin = window.location.origin;
  const seen = () => {
    try {
      chrome.runtime.sendMessage({ type: "proofline-seen" });
    } catch {
      // The extension was reloaded; nothing to tell.
    }
  };
  seen();
  // Leaving the tab is when edits are done; drop anything cached while it was open.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") seen();
  });

  // Listen on every app page: Proofline moves between pages without reloading,
  // so the Connect page may open after this script ran. The background worker
  // still accepts a token only from the Connect page itself.
  const ready = () => window.postMessage({ type: "proofline:extension-ready" }, origin);

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== origin) return;
    const data = event.data || {};
    if (data.type === "proofline:page-ready") ready();
    if (data.type === "proofline:extension-token" && typeof data.token === "string") {
      chrome.runtime.sendMessage({ type: "connect", token: data.token, origin }, (reply) => {
        if (reply && reply.ok) window.postMessage({ type: "proofline:extension-connected" }, origin);
      });
    }
  });

  ready();
})();
