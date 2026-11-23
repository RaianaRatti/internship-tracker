import { z } from "zod";
import { generate } from "./client";

export const ResumeImport = z.object({
  profile: z.object({
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    location: z.string().nullable(),
    headline: z.string().nullable(),
  }),
  education: z.array(
    z.object({
      school: z.string(),
      degree: z.string().nullable(),
      major: z.string().nullable(),
      minor: z.string().nullable(),
      gpa: z.string().nullable(),
      start: z.string().nullable(),
      end: z.string().nullable(),
      coursework: z.string().nullable(),
      honors: z.string().nullable(),
    }),
  ),
  experiences: z.array(
    z.object({
      kind: z.enum(["job", "internship", "research", "ta", "volunteer"]),
      org: z.string(),
      role: z.string(),
      location: z.string().nullable(),
      start: z.string().nullable(),
      end: z.string().nullable(),
      bullets: z.array(z.string()),
      skills: z.string().nullable(),
    }),
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string().nullable(),
      tech: z.string().nullable(),
      url: z.string().nullable(),
      impact: z.string().nullable(),
    }),
  ),
  skills: z.array(z.object({ name: z.string(), category: z.string().nullable() })),
  activities: z.array(z.object({ org: z.string(), role: z.string().nullable(), description: z.string().nullable() })),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
});
export type ResumeImportData = z.infer<typeof ResumeImport>;

/** Parse a resume (PDF or plain text) into vault items for the student to confirm (PLAN.md §3.1). */
export async function parseResume(input: { pdfBase64?: string; text?: string }): Promise<ResumeImportData> {
  const content = input.pdfBase64
    ? [
        { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: input.pdfBase64 } },
        { type: "text" as const, text: "Extract this resume into the schema." },
      ]
    : `Extract this resume into the schema.\n\n<resume>${input.text}</resume>`;
  const { data } = await generate(ResumeImport, {
    vault: "<student_vault>(empty — importing)</student_vault>",
    system:
      "Copy the resume's content into the schema faithfully. Do not rephrase bullets or add anything not on the page. Use null for missing fields. Keep dates as written.",
    content,
  });
  return data;
}
