import { resumeFromParams } from "@/lib/rules/resume-request";
import { resumeToDocx } from "@/lib/rules/resume";

export async function GET(req: Request) {
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const { doc, opp } = await resumeFromParams(sp);
  const buf = await resumeToDocx(doc);
  const name = `${doc.name} Resume${opp ? ` - ${opp.org}` : ""}`.replace(/[^\w\- ]+/g, "");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}.docx"`,
    },
  });
}
