// The extension's background worker. It stores the connection handed over by
// Proofline's Connect page (only from Proofline's own origins), and makes every
// request to Proofline for the badge on job sites, so the token never enters a
// job site's page.
const BETA = "https://proofline-beta.vercel.app";
const PROOFLINE_ORIGINS = [BETA, "http://localhost:3000"];
// A score is reused for the same job for this long, then checked again in case facts changed.
const CACHE_MS = 15 * 60 * 1000;
const inFlight = new Map();

async function connection() {
  const stored = await chrome.storage.local.get(["token", "origin", "pendingOrigin"]);
  return { token: stored.token || null, origin: stored.origin || stored.pendingOrigin || BETA };
}

async function api(path, init = {}) {
  const { token, origin } = await connection();
  if (!token) return { ok: false, signedOut: true };
  let res;
  try {
    res = await fetch(`${origin}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
  } catch {
    return { ok: false, error: "Couldn't reach Proofline. Check your connection and try again." };
  }
  if (res.status === 401) {
    await chrome.storage.local.remove(["token", "origin"]);
    return { ok: false, signedOut: true };
  }
  const data = await res.json().catch(() => null);
  if (!data) return { ok: false, error: "Proofline sent an unexpected reply. Try again." };
  if (!data.ok) return { ok: false, error: data.error || "Something went wrong. Try again." };
  return data;
}

async function score(key, posting) {
  if (!(await connection()).token) return { ok: false, signedOut: true };
  const cacheKey = `fit:${key}`;
  const cached = (await chrome.storage.session.get(cacheKey))[cacheKey];
  if (cached && Date.now() - cached.at < CACHE_MS) return { ok: true, result: cached.result };
  if (inFlight.has(key)) return inFlight.get(key);
  const pending = api("/api/extension/score", {
    method: "POST",
    body: JSON.stringify({ title: posting.title, company: posting.company, location: posting.location, description: posting.description }),
  }).then(async (data) => {
    if (!data.ok) return data;
    const result = { ...data };
    delete result.ok;
    await chrome.storage.session.set({ [cacheKey]: { at: Date.now(), result } });
    return { ok: true, result };
  });
  inFlight.set(key, pending);
  try {
    return await pending;
  } finally {
    inFlight.delete(key);
  }
}

async function openJob(posting, tabUrl) {
  const company = posting.company || new URL(posting.url).hostname.replace(/^www\./, "");
  const saved = await api("/api/extension/jobs", { method: "POST", body: JSON.stringify({ ...posting, company }) });
  if (!saved.ok) return saved;
  // Remembered so the popup's "I submitted it" finds this job.
  const jobs = (await chrome.storage.local.get("jobs")).jobs || {};
  jobs[tabUrl || posting.url] = saved.jobId;
  await chrome.storage.local.set({ jobs });
  await chrome.tabs.create({ url: saved.url });
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "connect") {
    const from = sender.url ? new URL(sender.url) : null;
    const trusted = from && PROOFLINE_ORIGINS.includes(from.origin) && from.pathname.startsWith("/app/extension") && message.origin === from.origin;
    if (!trusted || typeof message.token !== "string" || !message.token.startsWith("pl_")) {
      sendResponse({ ok: false });
      return false;
    }
    // A new connection may be a different account: drop scores cached for the old one.
    chrome.storage.session
      .clear()
      .then(() => chrome.storage.local.set({ token: message.token, origin: from.origin }))
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  // Everything below comes from the badge on a job site's page.
  if (!sender.tab) return false;
  if (message?.type === "score" && typeof message.key === "string" && message.posting) {
    score(message.key, message.posting).then(sendResponse);
    return true;
  }
  if (message?.type === "open-job" && message.posting) {
    openJob(message.posting, sender.tab.url).then(sendResponse, () => sendResponse({ ok: false, error: "Couldn't save this job. Try again." }));
    return true;
  }
  if (message?.type === "sign-in") {
    connection().then(({ origin }) => chrome.tabs.create({ url: `${origin}/login?next=${encodeURIComponent("/app/extension")}` }));
    return false;
  }
  if (message?.type === "open-page" && ["/app/jobs", "/app/facts"].includes(message.page)) {
    connection().then(({ origin }) => chrome.tabs.create({ url: `${origin}${message.page}` }));
    return false;
  }
  return false;
});

// First install: open the Connect page, which says what the extension reads and never reads.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") chrome.tabs.create({ url: `${BETA}/app/extension` });
});
