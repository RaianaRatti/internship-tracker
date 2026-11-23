const $ = (id) => document.getElementById(id);
const say = (t) => ($("status").textContent = t);
const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, r));

async function tab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

async function pageText(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => (document.querySelector("main, article, [role=main]") || document.body).innerText.slice(0, 40000),
  });
  return result;
}

let packet = null;

(async () => {
  const t = await tab();
  const cfg = await send({ type: "config" });
  if (!cfg.ok || !cfg.data.token) return say("Set your token first: open Settings (link below).");
  const res = await send({ type: "api", path: `/api/ext/packet?url=${encodeURIComponent(t.url)}` });
  if (!res.ok) return say(`✗ ${res.error}\nIs Quest Log running (npm run dev)?`);
  packet = res.data;
  say(packet.tracked
    ? `Tracked: ${packet.opportunity.org}\n${packet.opportunity.title}\nStatus: ${packet.status} · ${packet.answers.length} prepared answer(s)`
    : "Not tracked yet. Autofill still uses your Character Sheet.");
})();

$("autofill").onclick = async () => {
  const t = await tab();
  say("Filling…");
  await chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, files: ["autofill.js"] });
  window.close();
};

$("clip").onclick = async () => {
  const t = await tab();
  say("Reading the page…");
  const text = await pageText(t.id);
  const res = await send({ type: "api", path: "/api/ext/clip", init: { method: "POST", body: { url: t.url, text } } });
  say(res.ok ? `✓ Saved: ${res.data.org}, ${res.data.title}` : `✗ ${res.error}`);
};

$("applied").onclick = async () => {
  const t = await tab();
  const text = packet?.tracked ? undefined : await pageText(t.id);
  const res = await send({ type: "api", path: "/api/ext/applied", init: { method: "POST", body: { url: t.url, text, level: "L2" } } });
  say(res.ok ? "✓ Logged as Applied. Good luck!" : `✗ ${res.error}`);
};

$("open").onclick = async () => {
  const cfg = await send({ type: "config" });
  const base = cfg.data?.base ?? "http://localhost:3000";
  chrome.tabs.create({ url: packet?.applicationId ? `${base}/log/${packet.applicationId}` : `${base}/add` });
};
