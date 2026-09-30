// Filling a Greenhouse or Lever application from the person's answer kit, and the
// review panel that lists what was filled. The popup runs these inside the page
// through chrome.scripting.executeScript, so each function must be self-contained.
//
// Proofline never submits: nothing here presses a button, submits a form, or
// sends a key. tests/extension-no-submit.test.ts checks that in the source.

/**
 * Fills this frame's application form from a fill plan (/api/extension/kit) and
 * reports what it did. It types into empty fields and ticks Yes/No choices the kit
 * answers. Comboboxes that only react to a real click (Greenhouse's Yes/No menus,
 * place pickers) are left for the person, with the kit's answer shown beside them.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- called from popup.js
function fillFromKit(plan) {
  const NEVER = /gender|pronoun|\brace\b|ethnic|hispanic|latin[oax]|veteran|disab|sexual orientation|transgender|salary|compensation|pay (expectation|requirement|range)|desired pay|expected pay|hear about|how did you (find|learn|hear)|referr|consent|acknowledg|\bagree|certify|attest|signature|sign here|privacy|terms|previously (worked|employed|applied)|have you (ever )?(worked|been employed|applied)|former employee|relative|related to|criminal|convict|background check|drug|password|birth|\bage\b|\bssn\b|social security/i;
  const ABROAD = /canada|united kingdom|\bu\.?k\.?\b|england|singapore|india|australia|germany|france|ireland|netherlands|mexico|brazil|japan|china|israel|spain|poland|portugal|switzerland|sweden|hong kong|philippines|european union|\beu\b|emea|apac/i;
  const byKey = new Map(plan.answers.map((a) => [a.key, a]));
  const blankByKey = new Map(plan.blanks.map((b) => [b.key, b]));
  const firstKey = (group, field) => plan.keys.find((k) => k.startsWith(group + ".") && k.endsWith("." + field));
  const resolve = (key) => (key && byKey.has(key) ? { answer: byKey.get(key) } : key && blankByKey.has(key) ? { blank: blankByKey.get(key) } : null);
  // "Current company" means a role still going on; a finished one isn't current.
  const currentRole = (field) => {
    const end = byKey.get(firstKey("work", "end"));
    return end && /^present/i.test(end.value) ? resolve(firstKey("work", field)) : null;
  };
  const fullName = () => {
    const f = byKey.get("contact.first");
    const l = byKey.get("contact.last");
    return f && l ? { answer: { key: "contact.name", label: "Full name", value: `${f.value} ${l.value}`, source: f.source } } : resolve("contact.first");
  };

  // [what the field is called, which kit field answers it, what rules it out]. First match wins.
  const OTHERS = /reference|manager|supervisor|emergency|recruiter|referr/i;
  const TEXT = [
    [/first\s*name|given name|preferred name/i, () => resolve("contact.first"), OTHERS],
    [/last\s*name|surname|family name/i, () => resolve("contact.last"), OTHERS],
    [/full name|legal name|^\s*name\s*$/i, fullName, OTHERS],
    [/e-?mail/i, () => resolve("contact.email"), OTHERS],
    [/phone|mobile|\btel\b/i, () => resolve("contact.phone"), OTHERS],
    [/linkedin/i, () => resolve("contact.linkedin"), null],
    [/website|portfolio|personal (site|url)/i, () => resolve("contact.website"), /linkedin/i],
    [/current (company|employer)/i, () => currentRole("org"), null],
    [/current (job )?title/i, () => currentRole("title"), null],
    [/most recent (company|employer)/i, () => resolve(firstKey("work", "org")), null],
    [/most recent (job )?title/i, () => resolve(firstKey("work", "title")), null],
    [/^\s*(current )?location|^\s*city\b|where (are you|do you) (based|located|live)/i, () => resolve("contact.location"), /relocat|office|willing|prefer/i],
    [/school|university|college|institution/i, () => resolve(firstKey("education", "school")), null],
    [/\bdegree\b/i, () => resolve(firstKey("education", "degree")), null],
    [/major|discipline|field of study|concentration/i, () => resolve(firstKey("education", "major")), null],
    [/\bgpa\b|grade point/i, () => resolve(firstKey("education", "gpa")), null],
    [/graduat/i, () => resolve(firstKey("education", "grad")), null],
    [/earliest start|start date|when can you start|available to start|availability to start/i, () => resolve("eligibility.start"), null],
    [/cover letter/i, () => resolve("documents.letter"), null],
  ];
  const CHOICE = [
    [/sponsor/i, "eligibility.sponsorship"],
    [/authori[sz]ed to work|legally (able|eligible|permitted|authori[sz]ed) to work|eligib\w* to work|right to work/i, "eligibility.authorized"],
    [/\bcitizen/i, "eligibility.citizen"],
    [/(willing|open|able) to relocate|consider relocating|relocate for this/i, "eligibility.relocate"],
  ];
  // A typed Yes/No answer only fits a question that asks for one, not "If not, what sponsorship would you need?".
  const YES_NO_QUESTION = /^(are|will|do|does|would|can|could|is|have|did)\b/i;
  const OPEN_QUESTION = /\b(what|which|how|why|explain|describe|list|if (you|not|no))\b/i;

  const clean = (s) => String(s || "").replace(/[✱*]/g, " ").replace(/\s+/g, " ").trim();
  const questionLabel = (el) => {
    const upload = el.type === "file" && el.closest("[role=group][aria-labelledby]");
    if (upload) {
      const text = upload.getAttribute("aria-labelledby").split(/\s+/).map((id) => document.getElementById(id)?.innerText || "").join(" ");
      if (clean(text)) return clean(text);
    }
    const byId = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (byId && el.type !== "radio" && el.type !== "checkbox") return clean(byId.innerText);
    const by = el.getAttribute("aria-labelledby");
    if (by && el.type !== "radio" && el.type !== "checkbox") {
      const text = by.split(/\s+/).map((id) => document.getElementById(id)?.innerText || "").join(" ");
      if (clean(text)) return clean(text);
    }
    const lever = el.closest(".application-question");
    const leverLabel = lever && lever.querySelector(".application-label");
    if (leverLabel) return clean(leverLabel.innerText);
    const fieldset = el.closest("fieldset");
    const legend = fieldset && fieldset.querySelector("legend");
    if (legend) return clean(legend.innerText);
    const group = el.closest("[role=group], [role=radiogroup]");
    const groupBy = group && group.getAttribute("aria-labelledby");
    if (groupBy) return clean(groupBy.split(/\s+/).map((id) => document.getElementById(id)?.innerText || "").join(" "));
    if (byId) return clean(byId.innerText);
    const wrapping = el.closest("label");
    if (wrapping) return clean(wrapping.innerText);
    return clean(el.getAttribute("aria-label") || el.placeholder || el.name);
  };
  const optionText = (el) => {
    const byId = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    return clean((byId || el.closest("label") || {}).innerText || el.value);
  };
  const visible = (el) => {
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && (el.offsetParent !== null || style.position === "fixed");
  };
  const words = (s) => new Set(clean(s).toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length > 2));
  const similar = (a, b) => {
    const x = words(a);
    const y = words(b);
    if (!x.size || !y.size) return 0;
    let shared = 0;
    for (const w of x) if (y.has(w)) shared += 1;
    return shared / Math.max(x.size, y.size);
  };
  const questionFor = (label) => {
    let best = null;
    for (const a of plan.answers) {
      if (!a.key.startsWith("questions.")) continue;
      const score = clean(a.label).toLowerCase() === label.toLowerCase() ? 1 : similar(a.label, label);
      if (score >= 0.75 && (!best || score > best.score)) best = { score, answer: a };
    }
    return best && { answer: best.answer };
  };
  const setValue = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const yesNo = (value) => (/^yes\b/i.test(value) ? "yes" : /^no\b/i.test(value) ? "no" : null);

  const report = { frame: location.href, filled: [], choose: [], files: [], blank: [], stillEmpty: [] };
  window.__prooflineFilled = [];
  const handled = new Set();
  const noteBlank = (label, hit) => {
    if (!report.blank.some((b) => b.label === label)) report.blank.push({ label, reason: hit.blank.reason });
  };
  const filled = (el, label, answer) => {
    el.style.outline = "2px solid oklch(0.56 0.13 158)";
    el.style.outlineOffset = "2px";
    el.setAttribute("data-proofline-filled", "true");
    window.__prooflineFilled.push(el);
    report.filled.push({ label, value: answer.value, source: answer.source, index: window.__prooflineFilled.length - 1 });
  };

  const form = document.querySelector("#application-form, #application_form, form[action*='applications']") || document.querySelector("form") || document;
  const controls = [...form.querySelectorAll("input, textarea, select")].filter((el) => !el.disabled && el.type !== "hidden");

  // Files: the resume and cover letter are attached by the person.
  for (const el of controls.filter((c) => c.type === "file")) {
    const label = questionLabel(el) || "File";
    if (!report.files.includes(label)) report.files.push(label);
    handled.add(el);
  }

  const choiceFor = (label) => {
    if (NEVER.test(label) || ABROAD.test(label)) return null;
    const rule = CHOICE.find(([pattern]) => pattern.test(label));
    return rule ? resolve(rule[1]) : null;
  };

  // Yes/No questions as radio or checkbox groups.
  const groups = new Map();
  for (const el of controls.filter((c) => c.type === "radio" || c.type === "checkbox")) {
    const key = el.name || questionLabel(el);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(el);
  }
  for (const inputs of groups.values()) {
    inputs.forEach((i) => handled.add(i));
    const label = questionLabel(inputs[0]);
    const hit = choiceFor(label);
    if (!hit) continue;
    if (hit.blank) {
      noteBlank(label, hit);
      continue;
    }
    if (inputs.some((i) => i.checked)) continue;
    const want = yesNo(hit.answer.value);
    const options = inputs.filter((i) => yesNo(optionText(i)) === want);
    if (!want || options.length !== 1) {
      report.choose.push({ label, value: hit.answer.value, source: hit.answer.source });
      continue;
    }
    options[0].checked = true;
    options[0].dispatchEvent(new Event("input", { bubbles: true }));
    options[0].dispatchEvent(new Event("change", { bubbles: true }));
    filled(options[0], label, hit.answer);
  }

  // Yes/No questions as native selects.
  for (const el of controls.filter((c) => c instanceof HTMLSelectElement)) {
    handled.add(el);
    const label = questionLabel(el);
    const hit = choiceFor(label);
    if (!hit) continue;
    if (hit.blank) {
      noteBlank(label, hit);
      continue;
    }
    if (el.selectedIndex > 0 && el.value) continue;
    const want = yesNo(hit.answer.value);
    const options = [...el.options].filter((o) => o.value && yesNo(clean(o.text)) === want);
    if (!want || options.length !== 1) {
      report.choose.push({ label, value: hit.answer.value, source: hit.answer.source });
      continue;
    }
    setValue(el, options[0].value);
    filled(el, label, hit.answer);
  }

  // Text: known fields by their label, then the form's own questions matched to the kit's.
  for (const el of controls) {
    if (handled.has(el)) continue;
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (!(el instanceof HTMLTextAreaElement) && !["text", "email", "tel", "url", "search", "number"].includes(type)) continue;
    const label = questionLabel(el);
    if (!label || NEVER.test(label)) continue;
    const rule = TEXT.find(([pattern, , not]) => pattern.test(label) && !(not && not.test(label)));
    const asksChoice = CHOICE.some(([pattern]) => pattern.test(label));
    if (asksChoice && el.getAttribute("role") !== "combobox" && (!YES_NO_QUESTION.test(label) || OPEN_QUESTION.test(label))) continue;
    let hit = asksChoice ? choiceFor(label) : null;
    if (!hit && rule) hit = rule[1]();
    if (!hit) hit = questionFor(label);
    if (!hit) continue;
    if (hit.blank) {
      noteBlank(label, hit);
      continue;
    }
    if (el.getAttribute("role") === "combobox") {
      // Menus and place pickers only answer a real click. The person picks; the kit's answer sits beside it.
      if (!el.value) report.choose.push({ label, value: hit.answer.value, source: hit.answer.source });
      continue;
    }
    if (el.value || el.readOnly || !visible(el)) continue;
    if (el.maxLength > 0 && hit.answer.value.length > el.maxLength) {
      report.choose.push({ label, value: hit.answer.value, source: `${hit.answer.source}. It's longer than this box allows, so shorten it yourself.` });
      continue;
    }
    setValue(el, hit.answer.value);
    filled(el, label, hit.answer);
  }

  // List what was filled in the order it appears on the form.
  const order = window.__prooflineFilled.map((el, i) => ({ el, entry: report.filled[i] }));
  order.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  window.__prooflineFilled = order.map((o) => o.el);
  report.filled = order.map((o, i) => ({ ...o.entry, index: i }));

  // Required fields still empty after the fill, so nothing is missed before submit.
  const listed = new Set([...report.filled, ...report.choose, ...report.blank].map((r) => r.label));
  for (const el of controls) {
    if (el.type === "file") continue;
    const box = el.type === "radio" || el.type === "checkbox" ? el.closest("label") || el : el;
    if (!visible(box) && el.getAttribute("role") !== "combobox") continue;
    const label = questionLabel(el);
    const labelText = (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.innerText) || "";
    const required = el.required || el.getAttribute("aria-required") === "true" || /[✱*]\s*$/.test(labelText.trim());
    const empty = el.type === "radio" || el.type === "checkbox" ? !(groups.get(el.name || label) || [el]).some((i) => i.checked) : !el.value;
    if (required && empty && label && !listed.has(label) && !report.stillEmpty.includes(label)) report.stillEmpty.push(label);
  }
  return report;
}

/**
 * The review panel, drawn in the top frame after a fill. It lists every field
 * Proofline typed, what's left for the person, and how to keep a record of what they sent.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- called from popup.js
function showFillPanel(plan, reports) {
  document.querySelector("proofline-review")?.remove();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const all = { filled: [], choose: [], files: [], blank: [], stillEmpty: [] };
  for (const r of reports) {
    for (const f of r.filled) all.filled.push({ ...f, here: r.frame === location.href });
    all.choose.push(...r.choose);
    for (const f of r.files) if (!all.files.includes(f)) all.files.push(f);
    all.blank.push(...r.blank);
    for (const s of r.stillEmpty) if (!all.stillEmpty.includes(s)) all.stillEmpty.push(s);
  }
  const count = all.filled.length;
  const todo = all.choose.length + all.files.length + all.blank.length + all.stillEmpty.length;
  const row = (label, value, source, extra = "") =>
    `<li class="item"><p class="label">${esc(label)}</p>${value ? `<p class="value">${esc(value)}</p>` : ""}${source ? `<p class="source">${esc(source)}</p>` : ""}${extra}</li>`;
  const fileHelp = (label) =>
    /cover/i.test(label)
      ? "Download your cover letter from the job's packet in Proofline."
      : plan.resumeFileName
        ? `Your resume for this job is ${plan.resumeFileName}. Download it from the job's Resume tab.`
        : "Build your resume for this job in Proofline first.";

  const host = document.createElement("proofline-review");
  host.style.cssText = "all: initial; position: fixed; z-index: 2147483647; right: 12px; bottom: 12px;";
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host { --bg: oklch(1 0 0); --fg: oklch(0.2 0.014 170); --muted: oklch(0.973 0.006 160); --muted-fg: oklch(0.44 0.018 168); --subtle-fg: oklch(0.56 0.016 168);
        --border: oklch(0.918 0.008 160); --primary: oklch(0.255 0.035 166); --primary-fg: oklch(0.985 0.004 160); --primary-hover: oklch(0.3 0.04 166); --brand: oklch(0.56 0.13 158);
        --pending-ink: oklch(0.5 0.11 60); --pending-soft: oklch(0.975 0.035 85); }
      @media (prefers-color-scheme: dark) {
        :host { --bg: oklch(0.2 0.009 166); --fg: oklch(0.955 0.006 160); --muted: oklch(0.25 0.01 166); --muted-fg: oklch(0.76 0.012 164); --subtle-fg: oklch(0.64 0.012 164);
          --border: oklch(0.3 0.01 166); --primary: oklch(0.93 0.025 160); --primary-fg: oklch(0.2 0.03 166); --primary-hover: oklch(0.87 0.03 160); --brand: oklch(0.72 0.13 158);
          --pending-ink: oklch(0.86 0.11 82); --pending-soft: oklch(0.285 0.045 75); }
      }
      * { box-sizing: border-box; }
      :host, button, a, p, h2, h3, ul, li, span, div { font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; letter-spacing: normal; }
      button, a { cursor: pointer; }
      button:focus-visible, a:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
      .panel { width: min(360px, calc(100vw - 24px)); max-height: min(78vh, 640px); display: flex; flex-direction: column; overflow: hidden;
        border: 1px solid var(--border); border-radius: 16px; background: var(--bg); color: var(--fg); box-shadow: 0 24px 56px -24px rgb(0 0 0 / 0.45); }
      .head { flex: none; display: flex; gap: 10px; align-items: flex-start; padding: 14px 14px 12px 16px; border-bottom: 1px solid var(--border); }
      .head > div { flex: 1; min-width: 0; }
      h2 { margin: 0; font-size: 15px; font-weight: 650; }
      .sub { margin: 2px 0 0; color: var(--muted-fg); font-size: 13px; }
      .x { flex: none; width: 28px; height: 28px; margin: -2px -4px 0 0; padding: 0; border: 0; border-radius: 8px; background: none; color: var(--muted-fg); font-size: 20px; line-height: 1; }
      .x:hover { background: var(--muted); }
      .body { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; }
      section { padding: 12px 16px; border-bottom: 1px solid var(--border); }
      h3 { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
      ul { margin: 0; padding: 0; list-style: none; }
      p { margin: 0; }
      .item { padding: 8px 10px; border-radius: 10px; background: var(--muted); }
      .item + .item { margin-top: 6px; }
      .todo .item { background: var(--pending-soft); }
      .todo .label, .todo .value, .todo .source { color: var(--pending-ink); }
      .label { color: var(--muted-fg); font-size: 12px; }
      .value { margin-top: 2px; font-size: 13px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; white-space: pre-wrap; word-break: break-word; }
      .source { margin-top: 3px; color: var(--subtle-fg); font-size: 12px; }
      .show { margin-top: 4px; padding: 0; border: 0; background: none; color: var(--fg); font-size: 12px; font-weight: 600; text-decoration: underline; }
      .foot { flex: none; padding: 12px 16px 14px; }
      .note { color: var(--muted-fg); font-size: 13px; }
      .primary { display: flex; align-items: center; justify-content: center; margin-top: 10px; min-height: 38px; border-radius: 10px; background: var(--primary); color: var(--primary-fg); font-weight: 600; text-decoration: none; }
      .primary:hover { background: var(--primary-hover); }
    </style>
    <div class="panel" role="dialog" aria-label="What Proofline filled">
      <div class="head">
        <div>
          <h2>${count ? `Proofline filled ${count} ${count === 1 ? "field" : "fields"}` : "Proofline didn't fill anything here"}</h2>
          <p class="sub">${esc(plan.title)} at ${esc(plan.company)}. ${count ? "Each one is outlined in green on the form. Check them before you submit." : "The fields it knows are already filled, or this form asks for other things."}${todo ? ` ${todo} ${todo === 1 ? "item is" : "items are"} left for you below.` : ""}</p>
        </div>
        <button class="x" type="button" aria-label="Close">×</button>
      </div>
      <div class="body">
        ${count ? `<section><h3>Filled from your answer kit</h3><ul>${all.filled.map((f) => row(f.label, f.value, f.source, f.here ? `<button class="show" type="button" data-i="${f.index}">Show on the form</button>` : "")).join("")}</ul></section>` : ""}
        ${all.choose.length ? `<section class="todo"><h3>Choose these on the form yourself</h3><ul>${all.choose.map((f) => row(f.label, `Your answer: ${f.value}`, f.source)).join("")}</ul></section>` : ""}
        ${all.files.length ? `<section class="todo"><h3>Attach these yourself</h3><ul>${all.files.map((f) => row(f, fileHelp(f), "")).join("")}</ul></section>` : ""}
        ${all.blank.length ? `<section class="todo"><h3>Left blank: nothing confirmed</h3><ul>${all.blank.map((f) => row(f.label, "", f.reason)).join("")}</ul></section>` : ""}
        ${all.stillEmpty.length ? `<section class="todo"><h3>Required and still empty</h3><ul>${all.stillEmpty.slice(0, 12).map((f) => row(f, "", "")).join("")}</ul></section>` : ""}
      </div>
      <div class="foot">
        <p class="note">Proofline never submits. When it all looks right, press submit on their form, then choose I submitted it in the Proofline menu to keep a copy of what you sent.</p>
        <a class="primary" href="${esc(plan.kitUrl)}" target="_blank" rel="noreferrer">Open your answer kit</a>
      </div>
    </div>`;
  shadow.querySelector(".x").addEventListener("click", () => host.remove());
  for (const button of shadow.querySelectorAll(".show")) {
    button.addEventListener("click", () => {
      const el = (window.__prooflineFilled || [])[Number(button.dataset.i)];
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.focus({ preventScroll: true });
    });
  }
  document.documentElement.appendChild(host);
  return { shown: true, filled: count };
}
