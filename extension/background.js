// All calls to the local Quest Log app go through here (the service worker has host permission,
// so page CORS rules don't apply and the token never touches the page).
async function config() {
  const { base = "http://localhost:3000", token = "" } = await chrome.storage.local.get(["base", "token"]);
  return { base: base.replace(/\/$/, ""), token };
}

async function api(path, { method = "GET", body } = {}) {
  const { base, token } = await config();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-quest-token": token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function fileAsBase64(docId) {
  const { base, token } = await config();
  const res = await fetch(`${base}/api/documents/${docId}`, { headers: { "x-quest-token": token } });
  if (!res.ok) throw new Error(`Resume download failed (${res.status})`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  (async () => {
    try {
      if (msg.type === "api") return reply({ ok: true, data: await api(msg.path, msg.init) });
      if (msg.type === "file") return reply({ ok: true, data: await fileAsBase64(msg.docId) });
      if (msg.type === "config") return reply({ ok: true, data: await config() });
      reply({ ok: false, error: "unknown message" });
    } catch (e) {
      reply({ ok: false, error: String(e.message || e) });
    }
  })();
  return true; // async reply
});
