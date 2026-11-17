/**
 * Creates a superuser.
 *
 *   npm run create-admin -- --email you@example.com --name "Your Name"
 *
 * Prompts for the password (hidden). When stdin is not a terminal, the first
 * line of stdin is used as the password instead, for scripted setups.
 * Reads DATABASE_URL from the environment or from .env.local / .env.
 */
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { auditLogs, users } from "../src/db/schema";
import {
  hashPassword,
  normalizeEmail,
  passwordPolicyError,
} from "../src/lib/auth/password";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let input = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          cleanup();
          process.stdout.write("\n");
          return resolve(input);
        }
        if (ch === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          return reject(new Error("Cancelled"));
        }
        if (ch === "\u007f" || ch === "\b") input = input.slice(0, -1);
        else input += ch;
      }
    };
    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };
    stdin.on("data", onData);
  });
}

async function readFirstLineOfStdin(): Promise<string> {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data.split(/\r?\n/)[0] ?? "";
}

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
    },
  });

  const email = normalizeEmail(values.email ?? "");
  const name = (values.name ?? "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('Pass a valid --email, e.g. --email you@example.com --name "Your Name"');
  }
  if (!name) fail('Pass --name, e.g. --name "Your Name"');

  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL is not set (environment, .env.local or .env).");

  let password: string;
  if (process.stdin.isTTY) {
    password = await readHidden("Password: ");
    const policy = passwordPolicyError(password);
    if (policy) fail(policy);
    const confirm = await readHidden("Confirm password: ");
    if (password !== confirm) fail("Passwords don't match.");
  } else {
    password = await readFirstLineOfStdin();
    const policy = passwordPolicyError(password);
    if (policy) fail(policy);
  }

  const db = createDb(url, { max: 1 });
  try {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    if (existing) fail(`A user with email ${email} already exists.`);

    const [created] = await db
      .insert(users)
      .values({
        email,
        name,
        role: "superuser",
        passwordHash: await hashPassword(password),
        mustChangePassword: false,
        isActive: true,
      })
      .returning({ id: users.id });

    await db.insert(auditLogs).values({
      actorEmail: "cli",
      action: "user.created",
      targetType: "user",
      targetId: created.id,
      targetLabel: email,
      metadata: { role: "superuser", via: "cli" },
    });

    console.log(`Superuser ${email} created.`);
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
