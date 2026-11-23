import crypto from "node:crypto";
import { getExtensionToken } from "./settings";

/** The browser extension proves it was set up by the user with a shared token (PLAN.md §11). */
export async function checkExtensionAuth(req: Request): Promise<boolean> {
  const got = req.headers.get("x-quest-token") ?? "";
  const want = await getExtensionToken();
  return got.length === want.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export function cors(res: Response) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Headers", "content-type, x-quest-token");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return res;
}
