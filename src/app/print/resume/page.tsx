import { resumeFromParams } from "@/lib/rules/resume-request";
import { ResumeView } from "@/components/resume-view";
import { PrintButton } from "../[id]/print-button";
import type { SP } from "@/components/flash";

export default async function PrintResume({ searchParams }: { searchParams: SP }) {
  const { doc } = await resumeFromParams(await searchParams);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", color: "#000", overflow: "auto", zIndex: 200 }}>
      <div className="no-print" style={{ padding: 12, borderBottom: "1px solid #000" }}>
        <PrintButton />
      </div>
      <div style={{ maxWidth: "8.5in", margin: "24px auto", padding: "0.5in", background: "#fff" }}>
        <ResumeView doc={doc} />
      </div>
    </div>
  );
}
