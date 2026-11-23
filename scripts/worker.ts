// Background worker (PLAN.md §9): discovery, Gmail sync and housekeeping on a schedule.
// `npm run worker` loops forever; `npm run sync` runs once. `--only simplify,greenhouse` limits sources.
import "./env";
import { runDiscovery } from "../src/lib/sources/run";
import { runHousekeeping } from "../src/lib/apps";
import { syncGmail } from "../src/lib/gmail/sync";
import { getGoogleAccount } from "../src/lib/gmail/oauth";

const args = process.argv.slice(2);
const once = args.includes("--once");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1]?.split(",") : undefined;

const DISCOVERY_EVERY_MS = 6 * 3600_000; // every 6h (PLAN.md §5)
const GMAIL_EVERY_MS = 10 * 60_000; // every 10 min

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

async function discovery() {
  log("discovery: start");
  for (const s of await runDiscovery({ only })) log(`  ${s.ok ? "✓" : "✗"} ${s.source}: ${s.message}`);
}

async function gmail() {
  if (!(await getGoogleAccount())) return;
  try {
    const r = await syncGmail();
    log(`gmail: scanned ${r.scanned}, auto-updated ${r.autoUpdated}, review ${r.needsReview}, alerts ${r.alerts}`);
  } catch (e) {
    log("gmail: error", e instanceof Error ? e.message : e);
  }
}

async function housekeeping() {
  const r = await runHousekeeping();
  if (r.ghosted) log(`housekeeping: ${r.ghosted} marked ghosted`);
}

await discovery();
await gmail();
await housekeeping();

if (!once) {
  setInterval(() => void discovery().catch((e) => log("discovery error", e)), DISCOVERY_EVERY_MS);
  setInterval(() => void gmail().then(housekeeping).catch((e) => log("gmail error", e)), GMAIL_EVERY_MS);
  log("worker running; Ctrl+C to stop");
}
