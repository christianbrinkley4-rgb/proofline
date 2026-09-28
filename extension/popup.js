/* global extractPosting, fillForm */
// The popup: connect, then save the posting on this tab, fill its application from
// the person's profile, or record that they submitted it. Every request goes to the
// Proofline origin the Connect page handed over, with that connection's token.

const BETA = "https://proofline-beta.vercel.app";
const LOCAL = "http://localhost:3000";
const $ = (id) => document.getElementById(id);

let connection = null;
let tab = null;

function show(id) {
  $("disconnected").hidden = id !== "disconnected";
  $("connected").hidden = id !== "connected";
}

function status(message, { error = false, link = null } = {}) {
  const el = $("status");
  el.className = error ? "error" : "";
  el.textContent = message;
  if (link) {
    el.append(" ");
    const a = document.createElement("a");
    a.href = link.url;
    a.textContent = link.label;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: link.url });
    });
    el.append(a);
  }
}

function busy(on) {
  for (const id of ["save", "fill", "applied"]) $(id).disabled = on;
}

async function api(path, init = {}) {
  const res = await fetch(`${connection.origin}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${connection.token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({ ok: false, error: "Proofline sent an unexpected reply. Try again." }));
  if (res.status === 401) {
    await chrome.storage.local.remove(["token", "origin"]);
    throw new Error("This browser isn't connected anymore. Connect again from the Proofline icon.");
  }
  if (!data.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

async function inPage(func, args = []) {
  const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func, args });
  return result && result.result;
}

async function savedJobs() {
  return (await chrome.storage.local.get("jobs")).jobs || {};
}

async function saveJob() {
  const posting = await inPage(extractPosting);
  if (!posting || !posting.title) throw new Error("Couldn't find a job title on this page. Open the posting itself and try again.");
  if ((posting.description || "").length < 200) throw new Error("This page doesn't show the full posting. Open the job's own page, or paste the description into Proofline.");
  if (!posting.company) posting.company = new URL(posting.url).hostname.replace(/^www\./, "");
  const saved = await api("/api/extension/jobs", { method: "POST", body: JSON.stringify(posting) });
  const jobs = await savedJobs();
  jobs[tab.url] = saved.jobId;
  await chrome.storage.local.set({ jobs });
  return saved;
}

async function onSave() {
  busy(true);
  status("Reading the posting…");
  try {
    const saved = await saveJob();
    status(`Saved ${saved.title} at ${saved.company}. Fit ${saved.fit}.`, { link: { url: saved.url, label: "Open it" } });
  } catch (e) {
    status(e.message, { error: true });
  } finally {
    busy(false);
  }
}

async function onFill() {
  busy(true);
  status("Filling from your profile…");
  try {
    const { profile } = await api("/api/extension/profile");
    const result = await inPage(fillForm, [profile]);
    const filled = (result && result.filled) || 0;
    status(filled ? `Filled ${filled} ${filled === 1 ? "field" : "fields"}, outlined in green. Check each one before you submit.` : "No empty fields here that Proofline can fill.", { error: !filled });
  } catch (e) {
    status(e.message, { error: true });
  } finally {
    busy(false);
  }
}

async function onApplied() {
  busy(true);
  status("Updating your tracker…");
  try {
    let jobId = (await savedJobs())[tab.url];
    if (!jobId) jobId = (await saveJob()).jobId;
    const done = await api("/api/extension/applied", { method: "POST", body: JSON.stringify({ jobId }) });
    status("Marked Applied on your tracker, with a follow-up date.", { link: { url: done.url, label: "Open tracker" } });
  } catch (e) {
    status(e.message, { error: true });
  } finally {
    busy(false);
  }
}

async function init() {
  const stored = await chrome.storage.local.get(["token", "origin"]);
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!stored.token || !stored.origin) {
    show("disconnected");
    return;
  }
  connection = { token: stored.token, origin: stored.origin };
  show("connected");
  const onProofline = tab && tab.url && tab.url.startsWith(connection.origin);
  const scriptable = tab && tab.url && /^https?:/.test(tab.url) && !onProofline;
  $("page").textContent = scriptable ? tab.title || new URL(tab.url).hostname : "Open a job posting or application";
  busy(!scriptable);
  $("open").href = `${connection.origin}/app`;
}

$("connect").addEventListener("click", () => {
  const origin = $("use-local").checked ? LOCAL : BETA;
  chrome.tabs.create({ url: `${origin}/app/extension` });
  window.close();
});
$("save").addEventListener("click", onSave);
$("fill").addEventListener("click", onFill);
$("applied").addEventListener("click", onApplied);
$("open").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: `${connection.origin}/app` });
});
$("disconnect").addEventListener("click", async () => {
  await chrome.storage.local.remove(["token", "origin", "jobs"]);
  show("disconnected");
});

init();
