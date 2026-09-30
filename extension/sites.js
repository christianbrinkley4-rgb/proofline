// Runs on LinkedIn, Indeed, and Handshake. When a job posting is open, it reads
// the posting's title, company, location, and description (nothing else on the
// page), asks the background worker for the person's fit score, and shows it in
// a small badge. Everything it draws lives in a closed shadow root so the site's
// styles can't reach it, and every step is wrapped so a changed page never breaks.
(() => {
  if (window.top !== window || window.__prooflineFit) return;
  window.__prooflineFit = true;

  const clean = (s) => (s || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const numberIn = (re) => (u) => u.pathname.match(re)?.[1] || null;

  /** Indeed's 2026 header runs company, rating, place, and work setting together with no labels. The place is the first piece that isn't one of the others. */
  function indeedPlace() {
    const meta = document.querySelector('[data-testid="company-info-metadata"]');
    if (!meta) return "";
    const company = clean(meta.querySelector('a[href*="/cmp/"]')?.innerText);
    const pieces = [...meta.querySelectorAll("div, span")].filter((el) => !el.children.length).map((el) => clean(el.innerText));
    return pieces.find((p) => p && p !== company && !/^[·•|-]$/.test(p) && !/^\d(\.\d)?$/.test(p) && !/reviews?$/i.test(p)) || "";
  }

  // Selectors change often on these sites, so each field has several, newest first.
  // A description can also be found by the heading above it.
  const SITES = [
    {
      id: "linkedin",
      host: /(^|\.)linkedin\.com$/,
      key: (u) => u.searchParams.get("currentJobId") || numberIn(/^\/jobs\/view\/(?:[^/]*?-)?(\d+)/)(u),
      onJobs: (u) => u.pathname.startsWith("/jobs"),
      title: [
        ".job-details-jobs-unified-top-card__job-title h1",
        ".job-details-jobs-unified-top-card__job-title",
        ".jobs-unified-top-card__job-title",
        "h1.top-card-layout__title",
        ".topcard__title",
        ".jobs-details h1",
        "main h1",
      ],
      company: [
        ".job-details-jobs-unified-top-card__company-name a",
        ".job-details-jobs-unified-top-card__company-name",
        ".jobs-unified-top-card__company-name",
        "a.topcard__org-name-link",
        ".topcard__flavor a",
      ],
      location: [
        ".job-details-jobs-unified-top-card__primary-description-container .tvm__text",
        ".job-details-jobs-unified-top-card__bullet",
        ".jobs-unified-top-card__bullet",
        ".topcard__flavor--bullet",
      ],
      description: ["#job-details", ".jobs-description__content", ".jobs-description-content__text", ".jobs-box__html-content", ".show-more-less-html__markup", ".description__text"],
      heading: /^about the job$/i,
    },
    {
      id: "indeed",
      host: /(^|\.)indeed\.com$/,
      key: (u) => u.searchParams.get("vjk") || u.searchParams.get("jk"),
      onJobs: (u) => /^\/(viewjob|jobs|q-|m\/viewjob|rc\/clk|cmp\/[^/]+\/jobs)/.test(u.pathname) || u.searchParams.has("vjk") || u.searchParams.has("jk"),
      // The 2026 layout (checked live September 29) first, then the older one.
      title: [
        '[data-testid="vj-job-title"]',
        '[data-testid="jobsearch-JobInfoHeader-title"]',
        "h1.jobsearch-JobInfoHeader-title",
        ".jobsearch-JobInfoHeader-title",
        '[data-testid="simpler-jobTitle"]',
        ".jobsearch-JobInfoHeader-title-container h1",
        ".jobsearch-JobInfoHeader-title-container h2",
      ],
      company: [
        '[data-testid="company-info-metadata"] a[href*="/cmp/"]',
        '[data-testid="inlineHeader-companyName"]',
        '[data-company-name="true"]',
        '[data-testid="jobsearch-CompanyInfoContainer"] a',
        ".jobsearch-CompanyInfoContainer a",
        ".jobsearch-InlineCompanyRating div",
      ],
      location: [
        indeedPlace,
        '[data-testid="inlineHeader-companyLocation"]',
        '[data-testid="job-location"]',
        '[data-testid="jobsearch-JobInfoHeader-companyLocation"]',
        ".jobsearch-JobInfoHeader-subtitle > div:last-child",
      ],
      description: ['[data-testid="vj-job-description-heading"] + *', "#jobDescriptionText", '[data-testid="jobsearch-JobComponent-description"]', ".jobsearch-jobDescriptionText"],
      heading: /^(full )?job description$/i,
    },
    {
      id: "handshake",
      host: /(^|\.)joinhandshake\.com$/,
      key: numberIn(/\/(?:jobs|job-search|postings)\/(\d+)/),
      onJobs: (u) => /\/(jobs|job-search|postings)\b/.test(u.pathname),
      title: ['[data-hook="job-details-page"] h1', '[data-hook="job-title"]', "main h1", "h1"],
      company: ['a[href*="/e/"]', 'a[href*="/employers/"]', '[data-hook="employer-name"]'],
      location: ['[data-hook="job-location"]', '[data-hook="location"]'],
      description: ['[data-hook="job-description"]', '[class*="jobDescription"]', '[class*="job-description"]'],
      heading: /^(job description|about the (job|role|position)|description|what you'?ll do)$/i,
    },
  ];

  const site = SITES.find((s) => s.host.test(location.hostname));
  if (!site) return;

  const visible = (el) => el && el.getClientRects().length > 0;
  const firstText = (selectors, root = document) => {
    for (const selector of selectors) {
      try {
        if (typeof selector === "function") {
          const text = clean(selector());
          if (text) return text;
          continue;
        }
        for (const el of root.querySelectorAll(selector)) {
          const text = clean(el.innerText || el.textContent);
          if (text && visible(el)) return text;
        }
      } catch {
        // A selector the browser can't parse; try the next one.
      }
    }
    return "";
  };

  /**
   * The block under a heading like "About the job". What follows the heading comes
   * first, so a list of other jobs further down the same column isn't swept in;
   * failing that, the heading's nearest ancestor with real text.
   */
  function underHeading(pattern) {
    for (const h of document.querySelectorAll("h1, h2, h3, h4, h5, strong, [role=heading]")) {
      if (!pattern.test(clean(h.innerText)) || !visible(h)) continue;
      const after = [];
      for (let next = h.nextElementSibling; next; next = next.nextElementSibling) {
        if (/^H[1-4]$/.test(next.tagName) || next.getAttribute("role") === "heading") break;
        after.push(clean(next.innerText));
      }
      if (after.join("\n").length > 300) return after.join("\n");
      let box = h.parentElement;
      for (let depth = 0; box && depth < 5; depth += 1, box = box.parentElement) {
        const text = clean(box.innerText);
        if (text.length > 300) return text.replace(pattern, "").trim();
      }
    }
    return "";
  }

  /** Structured JobPosting data, which Indeed and LinkedIn's public pages include. Only trusted on a single-job page. */
  function structured() {
    const find = (node) => {
      if (!node || typeof node !== "object") return null;
      if (Array.isArray(node)) {
        for (const item of node) {
          const hit = find(item);
          if (hit) return hit;
        }
        return null;
      }
      const type = node["@type"];
      if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return node;
      return find(node["@graph"]);
    };
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const posting = find(JSON.parse(script.textContent || ""));
        if (!posting) continue;
        const doc = new DOMParser().parseFromString(String(posting.description || ""), "text/html");
        const place = [].concat(posting.jobLocation || [])[0]?.address || {};
        return {
          title: clean(String(posting.title || "")),
          company: clean(String(posting.hiringOrganization?.name || "")),
          location: posting.jobLocationType === "TELECOMMUTE" ? "Remote" : [place.addressLocality, place.addressRegion].filter(Boolean).join(", "),
          description: clean(doc.body.textContent || ""),
        };
      } catch {
        // Not JSON, or not a posting.
      }
    }
    return null;
  }

  function readPosting() {
    // Indeed puts a screen-reader-only "- job post" inside its title.
    const title = firstText(site.title).split("\n")[0].replace(/\s*-\s*job post$/i, "").slice(0, 200);
    let description = firstText(site.description) || underHeading(site.heading);
    let company = firstText(site.company).split("\n")[0].slice(0, 160);
    let place = firstText(site.location).split("\n")[0].slice(0, 160);
    if ((!title || description.length < 200) && document.querySelectorAll("h1").length <= 1) {
      const data = structured();
      if (data && data.description.length >= 200) return { title: data.title.slice(0, 200), company: data.company.slice(0, 160), location: data.location.slice(0, 160), description: data.description.slice(0, 40000) };
    }
    description = description.slice(0, 40000);
    company = company.replace(/\s*\d(\.\d)?\s*(out of 5 stars|★).*$/i, "").trim();
    place = place.replace(/^[·•]\s*/, "");
    return { title, company, location: place, description };
  }

  // ── The badge and panel ───────────────────────────────────────────────

  const host = document.createElement("proofline-fit");
  host.style.cssText = "all: initial; position: fixed; z-index: 2147483646; right: 0; top: 38vh;";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host { --bg: oklch(1 0 0); --fg: oklch(0.2 0.014 170); --muted: oklch(0.973 0.006 160); --muted-fg: oklch(0.44 0.018 168); --subtle-fg: oklch(0.56 0.016 168);
        --border: oklch(0.918 0.008 160); --primary: oklch(0.255 0.035 166); --primary-fg: oklch(0.985 0.004 160); --primary-hover: oklch(0.3 0.04 166);
        --brand: oklch(0.56 0.13 158); --brand-ink: oklch(0.44 0.1 160); --brand-soft: oklch(0.962 0.034 158); --pending-ink: oklch(0.5 0.11 60); --pending-soft: oklch(0.975 0.035 85);
        --destructive: oklch(0.577 0.245 27.3); --ink: oklch(0.235 0.034 166); --ink-fg: oklch(0.975 0.008 160); --ink-muted: oklch(0.76 0.03 162); }
      @media (prefers-color-scheme: dark) {
        :host { --bg: oklch(0.2 0.009 166); --fg: oklch(0.955 0.006 160); --muted: oklch(0.25 0.01 166); --muted-fg: oklch(0.76 0.012 164); --subtle-fg: oklch(0.64 0.012 164);
          --border: oklch(0.3 0.01 166); --primary: oklch(0.93 0.025 160); --primary-fg: oklch(0.2 0.03 166); --primary-hover: oklch(0.87 0.03 160);
          --brand: oklch(0.72 0.13 158); --brand-ink: oklch(0.8 0.12 158); --brand-soft: oklch(0.27 0.045 160); --pending-ink: oklch(0.86 0.11 82); --pending-soft: oklch(0.285 0.045 75);
          --destructive: oklch(0.7 0.18 24); --ink: oklch(0.26 0.03 166); }
      }
      * { box-sizing: border-box; }
      :host, button, a, p, h2, h3, ul, li, span, div { font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; letter-spacing: normal; }
      [hidden] { display: none !important; }
      button { cursor: pointer; }
      button:focus-visible, a:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
      .pill { display: flex; align-items: center; gap: 8px; min-height: 40px; max-width: 240px; padding: 0 12px 0 10px; border: 0; border-radius: 12px 0 0 12px;
        background: var(--ink); color: var(--ink-fg); box-shadow: 0 10px 28px -12px rgb(0 0 0 / 0.45); text-align: left; }
      .pill:hover { background: oklch(0.29 0.04 166); }
      .mark { flex: none; width: 18px; height: 18px; }
      .pill-text { overflow: hidden; font-size: 13px; font-weight: 500; white-space: nowrap; text-overflow: ellipsis; }
      .pill-score { font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }
      .pill-note { color: var(--ink-muted); font-size: 12px; }
      .dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--destructive); }
      .spin { flex: none; width: 14px; height: 14px; border: 2px solid var(--ink-muted); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .spin { animation: none; border-top-color: var(--ink-muted); opacity: 0.6; } }
      .panel { position: fixed; top: 12vh; right: 12px; width: min(360px, calc(100vw - 24px)); max-height: 76vh; display: flex; flex-direction: column; overflow: hidden;
        border: 1px solid var(--border); border-radius: 16px; background: var(--bg); color: var(--fg); box-shadow: 0 24px 56px -24px rgb(0 0 0 / 0.45); }
      .head { flex: none; display: flex; align-items: flex-start; gap: 10px; padding: 14px 14px 12px 16px; border-bottom: 1px solid var(--border); }
      .body { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; }
      .foot { flex: none; padding: 12px 16px 14px; border-top: 1px solid var(--border); }
      .head-text { flex: 1; min-width: 0; }
      .eyebrow { margin: 0; color: var(--subtle-fg); font-size: 12px; }
      .job { margin: 2px 0 0; overflow: hidden; font-size: 14px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
      .close { flex: none; width: 28px; height: 28px; margin: -2px -4px 0 0; padding: 0; border: 0; border-radius: 8px; background: none; color: var(--muted-fg); font-size: 20px; line-height: 1; }
      .close:hover { background: var(--muted); }
      section { padding: 14px 16px; border-bottom: 1px solid var(--border); }
      section:last-child { border-bottom: 0; }
      h3 { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
      p { margin: 0; color: var(--muted-fg); font-size: 13px; }
      ul { margin: 0; padding: 0; list-style: none; }
      .ko { display: flex; gap: 8px; padding: 8px 10px; border-radius: 10px; background: var(--muted); font-size: 13px; }
      .ko + .ko { margin-top: 6px; }
      .ko.out { background: color-mix(in oklch, var(--destructive) 9%, var(--bg)); }
      .ko b { font-weight: 600; }
      .ko span { color: var(--muted-fg); font-size: 13px; }
      .ko-icon { flex: none; margin-top: 1px; font-weight: 700; font-size: 13px; }
      .ko.out .ko-icon { color: var(--destructive); }
      .ok { display: flex; gap: 8px; color: var(--muted-fg); font-size: 13px; }
      .ok::before { content: "✓"; color: var(--brand); font-weight: 700; }
      .score { display: flex; align-items: baseline; gap: 8px; margin-bottom: 10px; }
      .score b { font-size: 34px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
      .score span { color: var(--muted-fg); font-size: 13px; }
      .row + .row { margin-top: 9px; }
      .row-top { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; }
      .row-top span:last-child { color: var(--muted-fg); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .bar { height: 4px; margin: 4px 0 2px; border-radius: 4px; background: var(--muted); overflow: hidden; }
      .bar i { display: block; height: 100%; border-radius: 4px; background: var(--brand); }
      .math { color: var(--subtle-fg); font-size: 12px; font-variant-numeric: tabular-nums; }
      .skills { margin-top: 12px; color: var(--muted-fg); font-size: 13px; }
      .skills b { color: var(--fg); font-weight: 600; }
      .thin { margin-top: 12px; padding: 8px 10px; border-radius: 10px; background: var(--pending-soft); color: var(--pending-ink); font-size: 13px; }
      .thin a, .link { color: inherit; font-weight: 600; }
      .primary { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 40px; border: 0; border-radius: 10px; background: var(--primary);
        color: var(--primary-fg); font-weight: 600; text-decoration: none; }
      .primary:hover { background: var(--primary-hover); }
      .primary:disabled { opacity: 0.6; cursor: default; }
      .fine { margin-top: 8px; color: var(--subtle-fg); font-size: 12px; }
      .error { margin-top: 8px; color: var(--destructive); font-size: 13px; }
    </style>
    <button class="pill" type="button" aria-expanded="false" aria-controls="panel" hidden></button>
    <div class="panel" id="panel" role="dialog" aria-label="Proofline fit" hidden></div>
  `;
  const pill = shadow.querySelector(".pill");
  const panel = shadow.querySelector(".panel");
  // The Proofline mark from app/icon.svg, drawn for a dark surface.
  const MARK = '<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 7.75h11M6.5 12h8M6.5 16.25h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16.25" cy="16.25" r="2.25" fill="oklch(0.72 0.13 158)"/></svg>';

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  let state = { kind: "idle" };
  let posting = null;

  function setPill(html, label) {
    pill.innerHTML = MARK + html;
    pill.setAttribute("aria-label", label);
    pill.hidden = false;
    if (!host.isConnected) document.documentElement.appendChild(host);
  }

  function hide() {
    pill.hidden = true;
    closePanel(false);
  }

  function render() {
    const s = state;
    if (s.kind === "idle") return hide();
    if (s.kind === "loading") return setPill('<span class="spin" aria-hidden="true"></span><span class="pill-text">Checking fit</span>', "Proofline is checking your fit");
    if (s.kind === "signed-out") return setPill('<span class="pill-text">Sign in to see your fit</span>', "Sign in to Proofline to see your fit");
    if (s.kind === "unreadable") return setPill('<span class="pill-text">Couldn\'t read this posting</span>', "Proofline couldn't read this posting. Open for options.");
    if (s.kind === "error") return setPill('<span class="pill-text">Fit unavailable</span>', "Proofline couldn't score this posting. Open for details.");
    const out = s.result.knockouts.filter((k) => k.status === "knockout").length;
    setPill(
      `<span class="pill-score">${s.result.score}</span><span class="pill-note">fit</span>${out ? '<span class="dot" aria-hidden="true"></span>' : ""}`,
      `Proofline fit score ${s.result.score} of 100${out ? `, ${out} knockout` : ""}. Open the breakdown.`,
    );
    if (!panel.hidden) fillPanel();
  }

  function fillPanel() {
    const s = state;
    const head = (eyebrow) => `
      <div class="head"><div class="head-text"><p class="eyebrow">${esc(eyebrow)}</p><p class="job">${esc(posting?.title || "This posting")}${posting?.company ? ` · ${esc(posting.company)}` : ""}</p></div>
      <button class="close" type="button" aria-label="Close">×</button></div>`;
    if (s.kind === "unreadable" || s.kind === "error") {
      panel.innerHTML = `${head("Proofline")}
        <div class="body"><section>
          <p>${s.kind === "unreadable" ? "This page didn't show a full job description Proofline could read. Open the job's own page, or paste the description into Proofline." : esc(s.message)}</p>
        </section></div>
        <div class="foot">
          ${s.kind === "error" ? '<button class="primary" type="button" data-act="retry">Try again</button>' : '<button class="primary" type="button" data-act="paste">Paste it in Proofline</button>'}
        </div>`;
      return;
    }
    if (s.kind !== "scored") return;
    const r = s.result;
    const knockouts = r.knockouts.length
      ? `<ul>${r.knockouts
          .map((k) => `<li class="ko ${k.status === "knockout" ? "out" : ""}"><span class="ko-icon" aria-hidden="true">${k.status === "knockout" ? "✕" : "?"}</span><div><b>${esc(k.label)}.</b> <span>${esc(k.reason)}</span></div></li>`)
          .join("")}</ul>`
      : '<p class="ok">None found: graduation date, work authorization, location, and start date all check out.</p>';
    const rows = r.components
      .map(
        (c) => `<li class="row"><div class="row-top"><span>${esc(c.label)}</span><span>${c.points} of ${c.max}</span></div>
          <div class="bar"><i style="width:${Math.round((100 * c.points) / c.max)}%"></i></div><div class="math">${esc(c.math)}</div></li>`,
      )
      .join("");
    const skills = [
      r.matchedSkills.length ? `<b>Shown in your facts:</b> ${esc(r.matchedSkills.join(", "))}.` : "",
      r.missingSkills.length ? `<b>Not in your facts yet:</b> ${esc(r.missingSkills.join(", "))}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const out = r.knockouts.some((k) => k.status === "knockout");
    // Header and the one action stay put; only the middle scrolls, so Open in Proofline is always in reach.
    panel.innerHTML = `${head("Proofline fit")}
      <div class="body">
        <section aria-labelledby="ko-h">
          <h3 id="ko-h">${out ? "Knockout: don't tailor for this job" : "Knockouts: none found"}</h3>${knockouts}
          ${out ? '<p class="fine">A tailored resume won\'t change a knockout. The score below shows how the rest lines up.</p>' : ""}
        </section>
        <section aria-labelledby="math-h">
          <h3 id="math-h">How the score adds up</h3>
          <div class="score"><b>${r.score}</b><span>of 100 · ${esc(r.band)}</span></div>
          <ul>${rows}</ul>
          ${skills ? `<p class="skills">${skills}</p>` : ""}
          ${r.ready ? "" : `<p class="thin">Your profile is thin, so this score has little to go on. <a href="#" data-act="facts">Add your education and one role</a>.</p>`}
        </section>
      </div>
      <div class="foot">
        <button class="primary" type="button" data-act="open">Open in Proofline</button>
        <p class="fine">Saves this job to your Proofline jobs. Proofline read only this job description and scored it against facts you confirmed.</p>
        <p class="error" role="alert" hidden></p>
      </div>`;
  }

  function openPanel() {
    fillPanel();
    panel.hidden = false;
    pill.setAttribute("aria-expanded", "true");
    // The panel covers where the badge sits; its close button brings the badge back.
    pill.style.visibility = "hidden";
    shadow.querySelector(".close")?.focus();
  }

  function closePanel(returnFocus = true) {
    if (panel.hidden) return;
    panel.hidden = true;
    pill.setAttribute("aria-expanded", "false");
    pill.style.visibility = "";
    if (returnFocus && !pill.hidden) pill.focus();
  }

  const send = (message) =>
    new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (reply) => resolve(chrome.runtime.lastError ? { ok: false, error: "The Proofline extension was updated. Reload this page." } : reply));
      } catch {
        resolve({ ok: false, error: "The Proofline extension was updated. Reload this page." });
      }
    });

  pill.addEventListener("click", () => {
    if (state.kind === "signed-out") {
      send({ type: "sign-in" });
      return;
    }
    if (state.kind === "loading") return;
    if (panel.hidden) openPanel();
    else closePanel();
  });

  panel.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-act], .close");
    if (!target) return;
    event.preventDefault();
    if (target.classList.contains("close")) return closePanel();
    const act = target.dataset.act;
    if (act === "retry") {
      identity = glance = null;
      closePanel(false);
      check();
    } else if (act === "paste" || act === "facts") {
      send({ type: "open-page", page: act === "paste" ? "/app/jobs" : "/app/facts" });
    } else if (act === "open" && posting) {
      target.disabled = true;
      target.textContent = "Saving…";
      const reply = await send({ type: "open-job", posting: { ...posting, url: location.href } });
      target.disabled = false;
      target.textContent = "Open in Proofline";
      if (!reply?.ok) {
        const err = shadow.querySelector(".error");
        if (err) {
          err.textContent = reply?.error || "Couldn't save this job. Try again.";
          err.hidden = false;
        }
        if (reply?.signedOut) {
          state = { kind: "signed-out" };
          render();
        }
      }
    }
  });

  shadow.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closePanel();
    }
  });

  // ── Watching the page ─────────────────────────────────────────────────
  // Score once the posting has settled, and again only when a different job opens.
  // Scrolling or a list loading more results changes nothing.

  let identity = null;
  let navigatedAt = Date.now();
  let lastUrl = location.href;
  let timer = null;
  let firstChange = 0;
  let request = 0;

  // The description is part of the job's identity, so a site that swaps it in after the title still gets a fresh score.
  function jobKey(url, p) {
    return `${site.id}:${site.key(url) || ""}:${p.title}|${p.company}|${p.description.length}:${p.description.slice(0, 60)}`;
  }

  /** A cheap look at what's on screen: address, title, and the description's size, without laying out the page. */
  function glimpse() {
    let size = 0;
    for (const selector of site.description) {
      const el = typeof selector === "string" ? document.querySelector(selector) : null;
      if (el) {
        size = el.textContent.length;
        break;
      }
    }
    return `${location.href}|${firstText(site.title)}|${size}`;
  }

  let glance = null;

  async function check() {
    try {
      const url = new URL(location.href);
      if (!site.onJobs(url)) {
        identity = glance = null;
        state = { kind: "idle" };
        return render();
      }
      // Same address and same title as the job already shown: nothing to do.
      const now = glimpse();
      if (now === glance && (state.kind === "scored" || state.kind === "signed-out")) return;
      glance = now;
      const p = readPosting();
      const complete = p.title && p.description.length >= 200;
      if (!complete) {
        // Give a slow page time to fill in; a job page that never does gets the fallback.
        glance = null;
        if (!site.key(url) && !p.title) {
          identity = null;
          state = { kind: "idle" };
          return render();
        }
        if (Date.now() - navigatedAt < 6000) {
          if (state.kind !== "loading") {
            state = { kind: "loading" };
            render();
          }
          window.setTimeout(schedule, 1200);
          return;
        }
        posting = p.title ? p : null;
        identity = null;
        state = { kind: "unreadable" };
        return render();
      }
      const id = jobKey(url, p);
      if (id === identity && state.kind !== "loading") return;
      identity = id;
      posting = p;
      const mine = ++request;
      if (state.kind !== "scored") {
        state = { kind: "loading" };
        render();
      }
      const reply = await send({ type: "score", key: id, posting: p });
      if (mine !== request) return;
      if (reply?.ok) state = { kind: "scored", result: reply.result };
      else if (reply?.signedOut) state = { kind: "signed-out" };
      else {
        identity = null;
        state = { kind: "error", message: reply?.error || "Couldn't reach Proofline. Check your connection and try again." };
      }
      render();
    } catch {
      // Never let a page change break the site. Show nothing rather than something wrong.
      state = { kind: "idle" };
      render();
    }
  }

  // Settle: wait for 300ms of quiet, but never more than 1.2s after the first change.
  function schedule() {
    const now = Date.now();
    if (!timer) firstChange = now;
    window.clearTimeout(timer);
    const wait = Math.max(0, Math.min(300, firstChange + 1200 - now));
    timer = window.setTimeout(() => {
      timer = null;
      check();
    }, wait);
  }

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  // These sites change jobs without reloading; watch the address.
  window.setInterval(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    navigatedAt = Date.now();
    schedule();
  }, 400);

  // Coming back to this tab: ask again. It's answered from the cache unless the
  // person was on Proofline in between, where their facts may have changed.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || state.kind !== "scored") return;
    identity = glance = null;
    schedule();
  });

  // Connecting or disconnecting in another tab updates this one.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && "token" in changes) {
      identity = glance = null;
      state = { kind: "loading" };
      schedule();
    }
  });

  // The page has loaded (document_idle), so look now; a page still filling in is retried as it settles.
  check();
})();
