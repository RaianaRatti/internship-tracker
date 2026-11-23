import { Document, Packer, Paragraph, TextRun } from "docx";
import { getProfile } from "../settings";

/** Clean, standard-looking Word export (exports never use the pixel style, PLAN.md §3.5). */
export async function docToDocx(body: string, opts: { includeHeader: boolean }) {
  const p = await getProfile();
  const header = opts.includeHeader
    ? [
        new Paragraph({ children: [new TextRun({ text: p.name || "", bold: true, size: 28, font: "Calibri" })] }),
        new Paragraph({
          children: [new TextRun({ text: [p.email, p.phone, p.location].filter(Boolean).join(" · "), size: 20, font: "Calibri" })],
          spacing: { after: 300 },
        }),
        new Paragraph({
          children: [new TextRun({ text: new Date().toLocaleDateString("en-US", { dateStyle: "long" }), size: 22, font: "Calibri" })],
          spacing: { after: 300 },
        }),
      ]
    : [];
  const doc = new Document({
    sections: [
      {
        children: [
          ...header,
          ...body.split(/\n{2,}/).map(
            (para) =>
              new Paragraph({
                // Single newlines (e.g. "Best,\nSam") become line breaks inside the paragraph.
                children: para.trim().split("\n").map((line, i) => new TextRun({ text: line, size: 22, font: "Calibri", break: i > 0 ? 1 : undefined })),
                spacing: { after: 200 },
              }),
          ),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
