import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { decrypt, encrypt } from "../crypto";

// PLAN.md §7: least privilege — read-only Gmail, requested only when the student turns sync on.
export const GMAIL_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"];

export function gmailConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri() {
  return process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/gmail/callback";
}

export function authUrl(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope: string; id_token?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Google token error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<TokenResponse>;
}

export async function exchangeCode(code: string) {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  const email = t.id_token ? (JSON.parse(Buffer.from(t.id_token.split(".")[1], "base64url").toString()).email as string) : null;
  const values = {
    provider: "google",
    accountEmail: email,
    scopes: t.scope,
    accessTokenEnc: encrypt(t.access_token),
    refreshTokenEnc: t.refresh_token ? encrypt(t.refresh_token) : null,
    expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000),
  };
  await db.insert(schema.oauthTokens).values(values).onConflictDoUpdate({ target: schema.oauthTokens.provider, set: values });
}

export async function getGoogleAccount() {
  return db.query.oauthTokens.findFirst({ where: eq(schema.oauthTokens.provider, "google") });
}

export async function accessToken(): Promise<string> {
  const row = await getGoogleAccount();
  if (!row?.accessTokenEnc) throw new Error("Gmail is not connected.");
  if (row.expiresAt && row.expiresAt.getTime() > Date.now()) return decrypt(row.accessTokenEnc);
  if (!row.refreshTokenEnc) throw new Error("Gmail session expired. Reconnect Gmail.");
  const t = await tokenRequest({ refresh_token: decrypt(row.refreshTokenEnc), grant_type: "refresh_token" });
  await db
    .update(schema.oauthTokens)
    .set({ accessTokenEnc: encrypt(t.access_token), expiresAt: new Date(Date.now() + (t.expires_in - 60) * 1000) })
    .where(eq(schema.oauthTokens.provider, "google"));
  return t.access_token;
}

/** "Disconnect Gmail" deletes tokens and all stored email metadata (PLAN.md §11). */
export async function disconnectGmail() {
  const row = await getGoogleAccount();
  if (row?.accessTokenEnc) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${decrypt(row.refreshTokenEnc ?? row.accessTokenEnc)}`, { method: "POST" }).catch(() => {});
  }
  await db.delete(schema.oauthTokens).where(eq(schema.oauthTokens.provider, "google"));
  await db.delete(schema.emails);
}
