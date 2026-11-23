import crypto from "node:crypto";

// AES-256-GCM for OAuth tokens and EEO answers (PLAN.md §11).
function key() {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET is not set. Run `npm run db:migrate` to generate one.");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decrypt(blob: string): string {
  const [iv, tag, data] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
