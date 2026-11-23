const base = document.getElementById("base");
const token = document.getElementById("token");
chrome.storage.local.get(["base", "token"]).then((c) => {
  base.value = c.base || "http://localhost:3000";
  token.value = c.token || "";
});
document.getElementById("save").onclick = async () => {
  await chrome.storage.local.set({ base: base.value.trim() || "http://localhost:3000", token: token.value.trim() });
  document.getElementById("ok").textContent = "✓ saved";
};
