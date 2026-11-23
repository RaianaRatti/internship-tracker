// Injected on click into the current tab (PLAN.md §4, L2). Fills fields from the Character Sheet
// and the application packet, outlines what it filled, and NEVER submits the form.
(async () => {
  if (window.__questLogFilling) return;
  window.__questLogFilling = true;
  const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, r));

  const [profileRes, packetRes] = await Promise.all([
    send({ type: "api", path: "/api/ext/profile" }),
    send({ type: "api", path: `/api/ext/packet?url=${encodeURIComponent(location.href)}` }),
  ]);
  if (!profileRes?.ok) {
    if (window === window.top) alert(`Quest Log: ${profileRes?.error ?? "could not reach the app"}`);
    window.__questLogFilling = false;
    return;
  }
  const p = profileRes.data;
  const packet = packetRes?.ok ? packetRes.data : { answers: [] };

  // ---------- helpers ----------
  const norm = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const tokens = (s) => new Set(norm(s).split(/[^a-z0-9]+/).filter((t) => t.length > 2));
  const sim = (a, b) => {
    const A = tokens(a), B = tokens(b);
    if (!A.size || !B.size) return 0;
    let n = 0;
    A.forEach((t) => B.has(t) && n++);
    return n / (A.size + B.size - n);
  };

  function labelFor(el) {
    const parts = [];
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) parts.push(l.innerText);
    }
    const wrap = el.closest("label");
    if (wrap) parts.push(wrap.innerText);
    if (el.getAttribute("aria-label")) parts.push(el.getAttribute("aria-label"));
    const by = el.getAttribute("aria-labelledby");
    if (by) by.split(/\s+/).forEach((id) => { const n = document.getElementById(id); if (n) parts.push(n.innerText); });
    parts.push(el.placeholder || "", el.name || "", el.id || "");
    if (parts.join("").trim().length < 3) {
      // Fall back to the nearest preceding text in the same field container (Workday, custom forms).
      const box = el.closest("[class*=field], [class*=question], [data-automation-id], li, .form-group, div");
      if (box) parts.push(box.innerText.slice(0, 200));
    }
    return norm(parts.join(" | "));
  }

  function setValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value); // works with React-controlled inputs
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function chooseOption(select, value) {
    const v = norm(String(value));
    const opt = [...select.options].find((o) => norm(o.text) === v) || [...select.options].find((o) => v && (norm(o.text).includes(v) || v.includes(norm(o.text))) && norm(o.text).length > 1);
    if (opt) { setValue(select, opt.value); return true; }
    return false;
  }

  const filled = [];
  const skipped = [];
  function mark(el, how) {
    el.style.outline = "3px dashed #000";
    el.style.outlineOffset = "2px";
    el.title = `Filled by Quest Log (${how}). Check it!`;
    filled.push(how);
  }

  const yesNo = (b) => (b ? "Yes" : "No");
  const authorized = !/not authorized|requires? sponsorship|f-1|opt|cpt|h-?1b/i.test(p.workAuthorization || "") || !p.needsSponsorship;

  // Order matters: specific patterns before generic ones.
  const RULES = [
    [/first.?name|given name|preferred name/, p.firstName],
    [/last.?name|family name|surname/, p.lastName],
    [/full.?name|^name\b|\| name \||your name/, p.fullName],
    [/e-?mail/, p.email],
    [/phone|mobile/, p.phone],
    [/linkedin/, p.linkedin],
    [/github/, p.github],
    [/website|portfolio|personal (site|url)|other url/, p.website],
    [/pronoun/, p.pronouns],
    [/school|university|college|institution/, p.school],
    [/degree/, p.degree],
    [/major|discipline|field of study|area of study/, p.major],
    [/\bgpa\b|grade point/, p.gpa],
    [/graduat|expected (completion|end)|class of/, p.graduationDate],
    [/sponsor/, yesNo(p.needsSponsorship)],
    [/authori[sz]ed to work|legally (eligible|authorized)|work authori[sz]ation/, yesNo(authorized)],
    [/\bcity\b|location|address|where are you (based|located)/, p.location],
    [/gender/, p.eeo?.gender],
    [/race|ethnic/, p.eeo?.race],
    [/veteran/, p.eeo?.veteran],
    [/disabilit/, p.eeo?.disability],
  ];

  const answers = [...(packet.answers || []), ...(p.answers || [])];

  // ---------- text, select and textarea fields ----------
  const fields = [...document.querySelectorAll("input, textarea, select")].filter((el) => {
    if (el.disabled || el.readOnly || el.type === "hidden" || el.offsetParent === null) return false;
    if (["submit", "button", "checkbox", "radio", "file", "password", "search"].includes(el.type)) return false;
    return !el.value || (el instanceof HTMLSelectElement && el.selectedIndex <= 0);
  });

  for (const el of fields) {
    const label = labelFor(el);
    if (!label) continue;
    if (/cover letter/.test(label) && el instanceof HTMLTextAreaElement && packet.coverLetter) {
      setValue(el, packet.coverLetter);
      mark(el, "cover letter");
      continue;
    }
    const rule = RULES.find(([re]) => re.test(label));
    if (rule && rule[1]) {
      if (el instanceof HTMLSelectElement) {
        if (chooseOption(el, rule[1])) mark(el, label.slice(0, 30));
      } else if (!(el instanceof HTMLTextAreaElement) || String(rule[1]).length > 0) {
        setValue(el, String(rule[1]));
        mark(el, label.slice(0, 30));
      }
      continue;
    }
    // Free-text questions: best match from prepared answers + answer bank.
    if (el instanceof HTMLTextAreaElement || (el.type === "text" && label.length > 25)) {
      let best = null;
      for (const a of answers) {
        const s = sim(label, a.question);
        if (s > 0.3 && (!best || s > best.s)) best = { s, a };
      }
      if (best) {
        setValue(el, best.a.answer);
        mark(el, `answer: ${best.a.question.slice(0, 30)}`);
      } else if (el instanceof HTMLTextAreaElement) {
        skipped.push(label.split("|")[0].slice(0, 80));
      }
    }
  }

  // ---------- yes/no radio groups ----------
  const groups = new Map();
  document.querySelectorAll('input[type="radio"]').forEach((r) => r.name && groups.set(r.name, [...(groups.get(r.name) || []), r]));
  for (const radios of groups.values()) {
    if (radios.some((r) => r.checked)) continue;
    const q = norm((radios[0].closest("fieldset, [role=radiogroup], [class*=question], li, div")?.innerText || "").slice(0, 300));
    let want = null;
    if (/sponsor/.test(q)) want = yesNo(p.needsSponsorship);
    else if (/authori[sz]ed to work|legally/.test(q)) want = yesNo(authorized);
    if (!want) continue;
    const pick = radios.find((r) => norm(labelFor(r)).startsWith(want.toLowerCase()) || norm(r.value) === want.toLowerCase());
    if (pick) {
      pick.click();
      mark(pick, q.slice(0, 30));
    }
  }

  // ---------- resume upload ----------
  const resume = packet.resume || p.defaultResume;
  const fileInput = [...document.querySelectorAll('input[type="file"]')].find((f) => /resume|cv/.test(labelFor(f)) || document.querySelectorAll('input[type="file"]').length === 1);
  if (resume && fileInput && !fileInput.files?.length) {
    const res = await send({ type: "file", docId: resume.id });
    if (res?.ok) {
      const bytes = Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], resume.filename, { type: resume.mime }));
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      mark(fileInput.parentElement || fileInput, `resume: ${resume.label}`);
    }
  }

  // ---------- summary box (top frame only) ----------
  if (window === window.top) {
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;width:300px;background:#fff;color:#000;border:2px solid #000;box-shadow:4px 4px 0 #000;font:14px/1.35 ui-monospace,Menlo,monospace;padding:10px";
    box.innerHTML = `<b>QUEST LOG</b> filled ${filled.length} field(s) (dashed outlines).<br>` +
      (skipped.length ? `<br>Still need you:<ul style="margin:4px 0 0 16px;padding:0">${skipped.slice(0, 6).map((s) => `<li>${s.replace(/</g, "&lt;")}</li>`).join("")}</ul>` : "") +
      `<br>Review everything, then submit yourself. Afterwards click the extension → <b>MARK APPLIED</b>.` +
      `<br><button style="margin-top:8px;font:inherit;border:2px solid #000;background:#fff;padding:2px 8px;cursor:pointer">close</button>`;
    box.querySelector("button").onclick = () => box.remove();
    document.body.appendChild(box);
  }
  window.__questLogFilling = false;
})();
