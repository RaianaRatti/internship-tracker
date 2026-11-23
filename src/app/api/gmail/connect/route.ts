import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authUrl, gmailConfigured } from "@/lib/gmail/oauth";

export async function GET() {
  if (!gmailConfigured()) redirect("/messenger?err=Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first");
  const state = crypto.randomBytes(16).toString("hex");
  (await cookies()).set("gmail_oauth_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  redirect(authUrl(state));
}
