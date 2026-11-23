// Polite fetching: identify ourselves, time out, and space out requests per host (PLAN.md §11).
const lastHit = new Map<string, number>();
const MIN_GAP_MS = 750;

function userAgent() {
  const contact = process.env.CRAWLER_CONTACT ? ` (+${process.env.CRAWLER_CONTACT})` : "";
  return `QuestLog/0.1 personal internship tracker${contact}`;
}

export async function politeFetch(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const host = new URL(url).host;
  const wait = (lastHit.get(host) ?? 0) + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());

  const res = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": userAgent(),
      Accept: "application/json, text/html;q=0.9",
      // Node 26's fetch truncates some zstd bodies (seen on amazon.jobs); stick to gzip/brotli.
      "Accept-Encoding": "gzip, deflate, br",
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(init.timeoutMs ?? 20_000),
  });
  return res;
}

export async function getJson<T>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  let res = await politeFetch(url, init);
  // Back off on rate limits (Workday in particular) instead of failing the whole company.
  for (let attempt = 1; res.status === 429 && attempt <= 3; attempt++) {
    const retryAfter = Number(res.headers.get("retry-after"));
    await new Promise((r) => setTimeout(r, (retryAfter > 0 ? retryAfter : 2 ** attempt * 2) * 1000));
    res = await politeFetch(url, init);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${new URL(url).host}`);
  return (await res.json()) as T;
}

/**
 * Plain node:https JSON request. Workday rejects undici's fetch (it adds sec-fetch-* headers)
 * with a 429 but serves the same request made without them.
 */
export async function httpsJson<T>(url: string, opts: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const { default: https } = await import("node:https");
  const host = new URL(url).host;
  const wait = (lastHit.get(host) ?? 0) + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());

  const payload = opts.body === undefined ? undefined : JSON.stringify(opts.body);
  return new Promise<T>((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: opts.method ?? "GET",
        timeout: 20_000,
        headers: {
          "User-Agent": userAgent(),
          Accept: "application/json",
          ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if ((res.statusCode ?? 500) >= 400) return reject(new Error(`${res.statusCode} from ${host}`));
          try {
            resolve(JSON.parse(text) as T);
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error(`Timed out fetching ${host}`)));
    req.on("error", reject);
    req.end(payload);
  });
}
