import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

// PLAN.md §6: a stronger model for writing, a fast one for parsing/classifying. Override via env.
export const GEN_MODEL = process.env.QUEST_GEN_MODEL || "claude-sonnet-5-5";
export const FAST_MODEL = process.env.QUEST_FAST_MODEL || "claude-haiku-4-5";

export class AiUnavailableError extends Error {
  constructor() {
    super("Claude API is not configured. Add ANTHROPIC_API_KEY to .env.local (or run `ant auth login`) and restart.");
  }
}

export function aiConfigured(): boolean {
  return !!(
    process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_AUTH_TOKEN ||
    process.env.ANTHROPIC_PROFILE ||
    fs.existsSync(path.join(os.homedir(), ".config", "anthropic"))
  );
}

let client: Anthropic | null = null;
export function ai(): Anthropic {
  if (!aiConfigured()) throw new AiUnavailableError();
  client ??= new Anthropic();
  return client;
}

type Content = string | Anthropic.ContentBlockParam[];

/** Cheap structured extraction (parsing postings, classifying email, matching). */
export async function extract<S extends z.ZodType>(
  schema: S,
  opts: { system: string; content: Content; maxTokens?: number },
): Promise<z.infer<S>> {
  const res = await ai().messages.parse({
    model: FAST_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
    output_config: { format: zodOutputFormat(schema) },
  });
  if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
  if (!res.parsed_output) throw new Error(`Could not parse model output (stop_reason: ${res.stop_reason}).`);
  return res.parsed_output as z.infer<S>;
}

/**
 * Writing tasks. The vault goes first as a cached system block because it is identical
 * across every generation (prompt caching, PLAN.md §6). Server-side fallbacks keep a
 * policy decline from failing the request outright.
 */
export async function generate<S extends z.ZodType>(
  schema: S,
  opts: { vault: string; system: string; content: Content; maxTokens?: number; model?: string },
): Promise<{ data: z.infer<S>; model: string }> {
  const res = await ai().beta.messages.parse({
    model: opts.model ?? GEN_MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: opts.vault, cache_control: { type: "ephemeral" } },
      { type: "text", text: opts.system },
    ],
    messages: [{ role: "user", content: opts.content }],
    output_config: { format: betaZodOutputFormat(schema) },
  });
  if (res.stop_reason === "refusal") throw new Error("The model declined this request.");
  if (!res.parsed_output) throw new Error(`Could not parse model output (stop_reason: ${res.stop_reason}).`);
  return { data: res.parsed_output as z.infer<S>, model: res.model };
}

export function describeAiError(e: unknown): string {
  if (e instanceof AiUnavailableError) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return "Claude API key was rejected. Check ANTHROPIC_API_KEY.";
  if (e instanceof Anthropic.RateLimitError) return "Claude API rate limit hit. Try again in a minute.";
  if (e instanceof Anthropic.APIError) return `Claude API error ${e.status}: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}
