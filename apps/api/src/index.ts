import type { Socket } from "node:net";
import { unwrapEnvFromKeyManager } from "@rakazo/adapters";
import { loadRootEnv } from "@rakazo/core/node/load-root-env";
import { stopOnShutdownSignals } from "@rakazo/core/node/shutdown-signals";

loadRootEnv();
await unwrapEnvFromKeyManager();

import { serve } from "@hono/node-server";
import { SERVICE_NAMES } from "@rakazo/logging";
import { createRootLogger } from "@rakazo/logging/axiom";
import { Hono } from "hono";
import { createApp } from "./app.js";
import { loadEnv } from "./env.js";

const logger = createRootLogger(SERVICE_NAMES.api);

let app: Hono<any>;

try {
  const env = loadEnv();
  const created = await createApp({ ...env, logger });
  app = created.app;

  // Only start node-server listener when NOT in a serverless environment (e.g. Vercel)
  if (!process.env.VERCEL) {
    const server = serve({ fetch: app.fetch, port: env.port, hostname: env.apiHost }, () => {
      logger.info("api listening", { "http.host": env.apiHost, "http.port": env.port });
    });
    // Desktop apps hold an outbound socket so bots can reach the user's own computer.
    if (created.handleUpgrade) server.on("upgrade", created.handleUpgrade);

    // SSE streams never end on their own, so server.close() alone would wait forever;
    // force-close sockets still open after a short grace period.
    const sockets = new Set<Socket>();
    server.on("connection", (socket) => {
      sockets.add(socket);
      socket.once("close", () => sockets.delete(socket));
    });

    let stopping = false;
    const shutdown = async () => {
      if (stopping) return;
      stopping = true;
      const closed = new Promise<void>((resolve) => server.close(() => resolve()));
      const grace = setTimeout(() => {
        for (const socket of sockets) socket.destroy();
      }, 2_000);
      await closed;
      clearTimeout(grace);
      await created.stop();
      await logger.flush({ timeoutMs: 2_000 });
    };
    stopOnShutdownSignals(shutdown);
  }
} catch (error) {
  logger.error("api startup failed", error);
  await logger.flush({ timeoutMs: 2_000 });

  if (process.env.VERCEL) {
    // In serverless deployment, provide graceful responses instead of crashing the function
    const fallbackApp = new Hono();
    fallbackApp.get("/api/auth/get-session", (c) => c.json(null));
    fallbackApp.get("/auth/get-session", (c) => c.json(null));
    fallbackApp.get("/api/health", (c) => c.json({ ok: true, status: "pending_database_url" }));
    fallbackApp.get("/health", (c) => c.json({ ok: true, status: "pending_database_url" }));
    fallbackApp.get("/api/ready", (c) => c.json({ ok: true, status: "pending_database_url" }));
    fallbackApp.get("/ready", (c) => c.json({ ok: true, status: "pending_database_url" }));
    fallbackApp.all("*", (c) =>
      c.json(
        {
          error: "SkyMolt Bot database configuration required",
          message:
            "Please configure the DATABASE_URL and BETTER_AUTH_SECRET environment variables in your Vercel Project Settings.",
          details: error instanceof Error ? error.message : String(error),
        },
        503,
      ),
    );
    app = fallbackApp;
  } else {
    process.exit(1);
  }
}

export default app;
