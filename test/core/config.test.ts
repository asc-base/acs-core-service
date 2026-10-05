import { once } from "node:events";
import { createServer } from "node:http";
import { afterEach, expect, test, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

test.each([undefined, ""])("Node can listen when APP_HOST is %s", async (host) => {
  vi.stubEnv("APP_HOST", host);
  vi.resetModules();
  const { config } = await import("../../src/core/config/config");
  const server = createServer();

  try {
    server.listen({ host: config.APP_HOST, port: 0 });
    await once(server, "listening");
    expect(config.APP_HOST).toBe("0.0.0.0");
  } finally {
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
