import type { Socket } from "node:net";
import { Hono } from "hono";

let appInstance: Hono<any> | null = null;
let initPromise: Promise<Hono<any>> | null = null;

function createFallbackApp(error?: any): Hono {
  const fallbackApp = new Hono();
  fallbackApp.get("/api/auth/get-session", (c) => c.json(null));
  fallbackApp.get("/auth/get-session", (c) => c.json(null));
  fallbackApp.get("/api/auth/capabilities", (c) => c.json({ signup: false, passkey: false }));
  fallbackApp.get("/auth/capabilities", (c) => c.json({ signup: false, passkey: false }));
  fallbackApp.get("/api/monitoring/config", (c) => c.json({}));
  fallbackApp.get("/monitoring/config", (c) => c.json({}));
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
        details: error instanceof Error ? error.message : String(error ?? "Initializing"),
      },
      503,
    ),
  );
  return fallbackApp;
}

async function initServer(): Promise<Hono<any>> {
  if (appInstance) return appInstance;
  try {
    const { loadRootEnv } = await import("@rakazo/core/node/load-root-env");
    const { unwrapEnvFromKeyManager } = await import("@rakazo/adapters");
    const { SERVICE_NAMES } = await import("@rakazo/logging");
    const { createRootLogger } = await import("@rakazo/logging/axiom");
    const { createApp } = await import("./app.js");
    const { loadEnv } = await import("./env.js");

    loadRootEnv();
    await unwrapEnvFromKeyManager();

    const logger = createRootLogger(SERVICE_NAMES.api);
    const env = loadEnv();
    const created = await createApp({ ...env, logger });
    appInstance = created.app;

    if (!process.env.VERCEL) {
      const { serve } = await import("@hono/node-server");
      const { stopOnShutdownSignals } = await import("@rakazo/core/node/shutdown-signals");
      const server = serve({ fetch: appInstance.fetch, port: env.port, hostname: env.apiHost }, () => {
        logger.info("api listening", { "http.host": env.apiHost, "http.port": env.port });
      });
      if (created.handleUpgrade) server.on("upgrade", created.handleUpgrade);
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
    return appInstance;
  } catch (error) {
    console.error("API initialization error:", error);
    if (process.env.VERCEL) {
      appInstance = createFallbackApp(error);
      return appInstance;
    }
    throw error;
  }
}

// In non-serverless mode (e.g. local dev / container), initialize immediately
if (!process.env.VERCEL) {
  initServer().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
  });
}

const app = new Hono();
app.all("*", async (c) => {
  if (!initPromise) {
    initPromise = initServer();
  }
  const realApp = await initPromise;
  return realApp.fetch(c.req.raw, c.env, c.executionCtx);
});

export default app;
