const STOP = new Set(
  "a an and are as at be by for from has have in is it of on or our that the this to we will with you your intern internship".split(" "),
);

export function tokenize(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .split(/[^a-z0-9+#.]+/)
    .map((t) => t.replace(/^\.+|\.+$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|technologies|services)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(summer|fall|winter|spring)\s*20\d\d\b/g, " ")
    .replace(/\b20\d\d\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Cross-source dedupe key: same company + same normalized title. */
export function dedupeKey(org: string, title: string): string {
  return `${normalizeCompany(org)}|${normalizeTitle(title)}`;
}

export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d|ul|ol)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&#8217;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

export function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

/** Jaccard similarity on token sets; used for matching questions and samples without embeddings. */
export function similarity(a: string, b: string): number {
  const A = new Set(tokenize(a));
  const B = new Set(tokenize(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export const stem = (t: string) => t.replace(/(ings?|ed|es|s|er|ers)$/, "").replace(/(.)\1$/, "$1");

/** Like `similarity`, but "profiling" matches "profiled" (crude suffix stemming). */
export function stemSimilarity(a: string, b: string): number {
  const A = new Set(tokenize(a).map(stem));
  const B = new Set(tokenize(b).map(stem));
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const t of A) if (B.has(t)) n++;
  return n / (A.size + B.size - n);
}
