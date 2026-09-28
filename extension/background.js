// Stores the connection handed over by Proofline's Connect page. Only a message
// from the content script on one of Proofline's own origins is accepted.
const PROOFLINE_ORIGINS = ["https://proofline-beta.vercel.app", "http://localhost:3000"];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "connect") return false;
  const from = sender.url ? new URL(sender.url) : null;
  const trusted = from && PROOFLINE_ORIGINS.includes(from.origin) && from.pathname.startsWith("/app/extension") && message.origin === from.origin;
  if (!trusted || typeof message.token !== "string" || !message.token.startsWith("pl_")) {
    sendResponse({ ok: false });
    return false;
  }
  chrome.storage.local.set({ token: message.token, origin: from.origin }).then(() => sendResponse({ ok: true }));
  return true;
});
