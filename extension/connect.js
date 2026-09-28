// Runs only on Proofline's Connect page. It tells the page the extension is here,
// and passes the token the page creates to the extension's storage. The token is
// never shown on screen.
(() => {
  const origin = window.location.origin;
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
