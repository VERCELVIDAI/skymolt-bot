import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const targetPath = resolve(process.cwd(), ".env");
const examplePath = resolve(process.cwd(), ".env.example");

if (existsSync(targetPath)) {
  console.log(".env already exists. Preserving existing configuration.");
  process.exit(0);
}

if (!existsSync(examplePath)) {
  console.error("Could not find .env.example");
  process.exit(1);
}

let content = readFileSync(examplePath, "utf-8");

const postgresPassword = randomBytes(16).toString("hex");
const postgresAppPassword = randomBytes(16).toString("hex");
const betterAuthSecret = randomBytes(32).toString("hex");
const encryptionKey = randomBytes(32).toString("hex");
const screenProxySecret = randomBytes(32).toString("hex");
const sandboxSupervisorToken = randomBytes(32).toString("hex");

content = content.replace(/^POSTGRES_PASSWORD=.*$/m, `POSTGRES_PASSWORD=${postgresPassword}`);
content = content.replace(/^POSTGRES_APP_PASSWORD=.*$/m, `POSTGRES_APP_PASSWORD=${postgresAppPassword}`);
content = content.replace(
  /DATABASE_URL=postgres:\/\/rakazo_app:REPLACE_WITH_POSTGRES_APP_PASSWORD@127\.0\.0\.1:5433\/rakazo/m,
  `DATABASE_URL=postgres://rakazo_app:${postgresAppPassword}@127.0.0.1:5433/rakazo`
);
content = content.replace(
  /DATABASE_MIGRATION_URL=postgres:\/\/rakazo:REPLACE_WITH_POSTGRES_PASSWORD@127\.0\.0\.1:5433\/rakazo/m,
  `DATABASE_MIGRATION_URL=postgres://rakazo:${postgresPassword}@127.0.0.1:5433/rakazo`
);
content = content.replace(
  /^BETTER_AUTH_SECRET=.*$/m,
  `BETTER_AUTH_SECRET=${betterAuthSecret}`
);
content = content.replace(
  /^ENCRYPTION_KEY=.*$/m,
  `ENCRYPTION_KEY=${encryptionKey}`
);
content = content.replace(
  /^SCREEN_PROXY_SECRET=.*$/m,
  `SCREEN_PROXY_SECRET=${screenProxySecret}`
);
content = content.replace(
  /^SANDBOX_SUPERVISOR_TOKEN=.*$/m,
  `SANDBOX_SUPERVISOR_TOKEN=${sandboxSupervisorToken}`
);

writeFileSync(targetPath, content, "utf-8");
console.log("Generated .env file with secure secrets for SkyMolt Bot.");
