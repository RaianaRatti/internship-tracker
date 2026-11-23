import fs from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { checkExtensionAuth } from "@/lib/ext-auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Same-origin page loads are fine; the extension must present its token.
  if (req.headers.get("x-quest-token") && !(await checkExtensionAuth(req))) return new Response("Unauthorized", { status: 401 });
  const doc = await db.query.documents.findFirst({ where: eq(schema.documents.id, Number(id)) });
  if (!doc) return new Response("Not found", { status: 404 });
  const data = await fs.readFile(doc.storagePath);
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": doc.mime, "Content-Disposition": `inline; filename="${doc.filename.replace(/"/g, "")}"` },
  });
}
