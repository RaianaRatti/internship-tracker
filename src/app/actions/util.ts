import { redirect } from "next/navigation";

export function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function num(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s == null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Redirect back with a one-line message the page shows in an alert box. */
export function back(path: string, msg: string, kind: "ok" | "err" = "ok"): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind === "ok" ? "msg" : "err"}=${encodeURIComponent(msg)}`);
}

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
