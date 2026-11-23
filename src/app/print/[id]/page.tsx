import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getProfile } from "@/lib/settings";
import { PrintButton } from "./print-button";

// Clean print view: use the browser's "Save as PDF". Exports never use the pixel style.
export default async function PrintDoc({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await db.query.generatedDocs.findFirst({ where: eq(schema.generatedDocs.id, Number(id)) });
  if (!doc) notFound();
  const p = await getProfile();
  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", color: "#000", overflow: "auto", zIndex: 200 }}>
      <div className="no-print" style={{ padding: 12, borderBottom: "2px solid #000" }}>
        <PrintButton />
      </div>
      <article className="paper" style={{ maxWidth: 680, margin: "40px auto", padding: "0 24px", fontSize: 15 }}>
        {doc.kind === "cover_letter" && (
          <header style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{p.name}</div>
            <div>{[p.email, p.phone, p.location].filter(Boolean).join(" · ")}</div>
            <div style={{ marginTop: 18 }}>{new Date().toLocaleDateString("en-US", { dateStyle: "long" })}</div>
          </header>
        )}
        {doc.body.split(/\n{2,}/).map((para, i) => <p key={i} style={{ marginBottom: 14, whiteSpace: "pre-line" }}>{para}</p>)}
      </article>
    </div>
  );
}
