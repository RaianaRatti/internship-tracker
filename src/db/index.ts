import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL || "file:./data/quest.db";

// Reuse one client across Next.js hot reloads.
const globalForDb = globalThis as unknown as { __questDb?: ReturnType<typeof makeDb> };

function makeDb() {
  const client = createClient({ url });
  return drizzle(client, { schema });
}

export const db = globalForDb.__questDb ?? makeDb();
if (process.env.NODE_ENV !== "production") globalForDb.__questDb = db;

export { schema };
