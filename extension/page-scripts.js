// Functions the popup runs inside the page you're viewing, through
// chrome.scripting.executeScript. Each must be self-contained: Chrome copies only
// the function's own source into the page.

/** Reads the posting on the page: structured JobPosting data when the site has it, the visible page otherwise. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- called from popup.js
function extractPosting() {
  const text = (html) => {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    return (doc.body.innerText || doc.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  };
  const findPosting = (node) => {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = findPosting(item);
        if (found) return found;
      }
      return null;
    }
    const type = node["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return node;
    return findPosting(node["@graph"]);
  };

  let posting = null;
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      posting = findPosting(JSON.parse(script.textContent || ""));
    } catch {
      posting = null;
    }
    if (posting) break;
  }

  const meta = (name) => document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute("content")?.trim() || "";
  if (posting) {
    const places = [].concat(posting.jobLocation || []).map((l) => {
      const a = (l && l.address) || {};
      return [a.addressLocality, a.addressRegion].filter(Boolean).join(", ");
    });
    const remote = posting.jobLocationType === "TELECOMMUTE" ? "Remote" : "";
    return {
      url: location.href,
      title: String(posting.title || "").trim(),
      company: String((posting.hiringOrganization && posting.hiringOrganization.name) || meta("og:site_name") || "").trim(),
      location: [places.filter(Boolean)[0], remote].filter(Boolean).join(" · "),
      description: text(posting.description).slice(0, 40000),
    };
  }

  const main = document.querySelector("main, article, [role=main]") || document.body;
  return {
    url: location.href,
    title: (document.querySelector("h1")?.innerText || meta("og:title") || document.title || "").trim().slice(0, 200),
    company: meta("og:site_name"),
    location: "",
    description: (main.innerText || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 40000),
  };
}

/**
 * Fills empty text fields on an application form from the person's Proofline
 * profile, highlights each one, and shows a note to check them. It skips
 * anything sensitive (authorization, demographics, salary) and never submits.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- called from popup.js
function fillForm(profile) {
  const SKIP = /sponsor|authori[sz]|visa|citizen|gender|sex\b|race|ethnic|hispanic|veteran|disab|salary|compensation|pay\b|referr|hear about|pronoun|password|birth|age\b|ssn|social security|signature/i;
  const location = [profile.city, profile.region].filter(Boolean).join(", ");
  // [what the field is called, what goes in it, what rules it out]. First match wins.
  const OTHER_PEOPLE_OR_PLACES = /company|employer|organi[sz]ation|school|university|college|reference|manager|supervisor|emergency|user ?name|file/i;
  const RULES = [
    [/given-name|first.?name|fname|preferred name/i, profile.firstName, OTHER_PEOPLE_OR_PLACES],
    [/family-name|last.?name|lname|surname|family name/i, profile.lastName, OTHER_PEOPLE_OR_PLACES],
    [/e-?mail/i, profile.email, /reference|manager|supervisor|emergency/i],
    [/\btel\b|phone|mobile|cell/i, profile.phone, /reference|manager|supervisor|emergency/i],
    [/linkedin/i, profile.linkedin, null],
    [/website|portfolio|personal (site|url)/i, profile.website, /github|twitter|company/i],
    [/full.?name|legal name|^name$|\bname\b/i, profile.fullName, OTHER_PEOPLE_OR_PLACES],
    [/\bcity\b|address-level2/i, profile.city, null],
    [/\bstate\b|province|region|address-level1/i, profile.region, null],
    [/location|where are you (based|located)|current address/i, location, /job|office|preferred|willing/i],
    [/school|university|college|institution/i, profile.school, null],
    [/degree/i, profile.degree, null],
    [/major|field of study|discipline|concentration/i, profile.major, null],
    [/\bgpa\b|grade point/i, profile.gpa, null],
    [/graduation (date|year|month)|expected graduation|grad date/i, profile.graduation, null],
  ];

  const labelText = (el) => {
    const parts = [el.getAttribute("autocomplete"), el.name, el.id, el.placeholder, el.getAttribute("aria-label")];
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) parts.push(label.innerText);
    }
    const wrapping = el.closest("label");
    if (wrapping) parts.push(wrapping.innerText);
    const by = el.getAttribute("aria-labelledby");
    if (by) for (const id of by.split(/\s+/)) parts.push(document.getElementById(id)?.innerText);
    return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  };

  const setValue = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const fields = [...document.querySelectorAll("input")].filter((el) => {
    const type = (el.getAttribute("type") || "text").toLowerCase();
    const style = getComputedStyle(el);
    return ["text", "email", "tel", "url", "search"].includes(type) && !el.disabled && !el.readOnly && !el.value && style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
  });

  let filled = 0;
  for (const el of fields) {
    const label = labelText(el);
    if (!label || SKIP.test(label)) continue;
    const rule = RULES.find(([pattern, , not]) => pattern.test(label) && !(not && not.test(label)));
    const value = rule && rule[1];
    if (!value) continue;
    setValue(el, value);
    el.style.outline = "2px solid oklch(0.56 0.13 158)";
    el.style.outlineOffset = "2px";
    el.setAttribute("data-proofline-filled", "true");
    filled += 1;
  }

  document.getElementById("proofline-fill-note")?.remove();
  const note = document.createElement("div");
  note.id = "proofline-fill-note";
  note.setAttribute("role", "status");
  note.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:320px;padding:14px 16px;border-radius:14px;background:oklch(0.235 0.034 166);color:oklch(0.975 0.008 160);font:14px/1.45 system-ui,sans-serif;box-shadow:0 12px 32px -12px rgb(0 0 0/.35)";
  note.textContent = filled
    ? `Proofline filled ${filled} ${filled === 1 ? "field" : "fields"}, outlined in green. Check each one before you submit. Proofline never submits for you.`
    : "Proofline didn't find any empty fields it can fill here. If the form is inside a frame, open the application on its own page.";
  const close = document.createElement("button");
  close.textContent = "Close";
  close.style.cssText = "display:block;margin-top:8px;padding:0;border:0;background:none;color:oklch(0.76 0.03 162);font:inherit;text-decoration:underline;cursor:pointer";
  close.addEventListener("click", () => note.remove());
  note.appendChild(close);
  document.body.appendChild(note);
  return { filled };
}
