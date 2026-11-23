"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { wordCount } from "@/lib/core/text";
import { buildVoiceProfile } from "@/lib/ai/forge";
import { describeAiError } from "@/lib/ai/client";
import { back, str } from "./util";

export async function saveSample(id: number | null, fd: FormData) {
  const title = str(fd, "title");
  const body = str(fd, "body");
  if (!title || !body) back("/spellbook", "Title and text are required", "err");
  const values = { title: title!, body: body!, prompt: str(fd, "prompt"), tags: str(fd, "tags"), wordCount: wordCount(body!) };
  if (id) await db.update(schema.writingSamples).set(values).where(eq(schema.writingSamples.id, id));
  else await db.insert(schema.writingSamples).values(values);
  back("/spellbook", "Sample saved");
}

export async function deleteSample(id: number) {
  await db.delete(schema.writingSamples).where(eq(schema.writingSamples.id, id));
  revalidatePath("/spellbook");
}

export async function saveAnswer(id: number | null, fd: FormData) {
  const question = str(fd, "question");
  const answer = str(fd, "answer");
  if (!question || !answer) back("/spellbook?tab=answers", "Question and answer are required", "err");
  const values = { question: question!, answer: answer!, tags: str(fd, "tags") };
  if (id) await db.update(schema.answerBank).set(values).where(eq(schema.answerBank.id, id));
  else await db.insert(schema.answerBank).values(values);
  back("/spellbook?tab=answers", "Answer saved");
}

export async function deleteAnswerBank(id: number) {
  await db.delete(schema.answerBank).where(eq(schema.answerBank.id, id));
  revalidatePath("/spellbook");
}

export async function rebuildVoice() {
  try {
    await buildVoiceProfile();
  } catch (e) {
    back("/spellbook", describeAiError(e), "err");
  }
  back("/spellbook", "Voice profile updated");
}

export async function saveStory(id: number | null, fd: FormData) {
  const from = str(fd, "from") ?? "/spellbook?tab=stories";
  const values = {
    title: str(fd, "title"),
    hook: str(fd, "hook"),
    action: str(fd, "action"),
    lesson: str(fd, "lesson"),
    theme: str(fd, "theme"),
    tags: str(fd, "tags"),
  };
  const missing = (["title", "hook", "action", "lesson", "theme"] as const).filter((k) => !values[k]);
  if (missing.length) back(from, `Fill in: ${missing.join(", ")}`, "err");
  const v = values as { title: string; hook: string; action: string; lesson: string; theme: string; tags: string | null };
  if (id) await db.update(schema.stories).set(v).where(eq(schema.stories.id, id));
  else await db.insert(schema.stories).values(v);
  back(from, "Story saved");
}

export async function deleteStory(id: number) {
  await db.delete(schema.stories).where(eq(schema.stories.id, id));
  revalidatePath("/spellbook");
}
