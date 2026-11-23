import "./env";
import fs from "node:fs";
import crypto from "node:crypto";
import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "../src/db";

fs.mkdirSync("data/uploads", { recursive: true });

// First run: create .env.local with a random APP_SECRET so encryption works out of the box.
if (!process.env.APP_SECRET) {
  const secret = crypto.randomBytes(32).toString("hex");
  fs.appendFileSync(".env.local", `\nAPP_SECRET=${secret}\n`);
  process.env.APP_SECRET = secret;
  console.log("Generated APP_SECRET in .env.local");
}

await migrate(db, { migrationsFolder: "drizzle" });
console.log("Database ready");
