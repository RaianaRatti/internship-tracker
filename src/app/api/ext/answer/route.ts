import { guard, preflight, findByUrl } from "@/lib/ext";
import { answerQuestion } from "@/lib/ai/answers";

export const OPTIONS = preflight;

/** Answer one free-text form question (answer bank first, adapted with AI when company-specific). */
export function POST(req: Request) {
  return guard(req, async () => {
    const { question, url } = (await req.json()) as { question: string; url: string };
    const hit = await findByUrl(url);
    return answerQuestion(question, hit?.opp);
  });
}
