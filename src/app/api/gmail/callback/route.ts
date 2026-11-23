import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { exchangeCode } from "@/lib/gmail/oauth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const expected = jar.get("gmail_oauth_state")?.value;
  jar.delete("gmail_oauth_state");
  if (url.searchParams.get("error")) redirect(`/messenger?err=${encodeURIComponent(url.searchParams.get("error")!)}`);
  if (!expected || url.searchParams.get("state") !== expected) redirect("/messenger?err=OAuth state mismatch, try again");
  const code = url.searchParams.get("code");
  if (!code) redirect("/messenger?err=No authorization code returned");
  let err: string | null = null;
  try {
    await exchangeCode(code);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  redirect(err ? `/messenger?err=${encodeURIComponent(err)}` : "/messenger?msg=Gmail connected. Press SYNC NOW for the first scan.");
}
