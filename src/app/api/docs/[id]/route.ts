import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { docToDocx } from "@/lib/export/docx";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await db.query.generatedDocs.findFirst({ where: eq(schema.generatedDocs.id, Number(id)) });
  if (!doc) return new Response("Not found", { status: 404 });
  const buf = await docToDocx(doc.body, { includeHeader: doc.kind === "cover_letter" });
  const name = doc.title.replace(/[^\w\- ]+/g, "").trim() || "document";
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}.docx"`,
    },
  });
}
