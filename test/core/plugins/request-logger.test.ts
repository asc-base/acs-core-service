import { afterEach, describe, expect, test, vi } from "vitest";
import { Elysia } from "elysia";
import {
  logRequest,
  requestLogger,
} from "../../../src/core/plugins/request-logger";

const afterResponse = () => new Promise<void>((resolve) => setImmediate(resolve));
const parseLog = (call: unknown[] | undefined) => JSON.parse(String(call?.[0]));

afterEach(() => vi.restoreAllMocks());

describe("request logging", () => {
  test("logs successful requests with status and duration", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const app = new Elysia().use(requestLogger).get("/items", () => "ok");

    const response = await app.handle(new Request("http://localhost/items"));
    await afterResponse();

    expect(response.status).toBe(200);
    expect(parseLog(info.mock.calls[0])).toEqual({
      type: "http.request",
      method: "GET",
      path: "/items",
      status: 200,
      durationMs: expect.any(Number),
    });
  });

  test("warns for not found responses", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const app = new Elysia().use(requestLogger).get("/items", () => "ok");

    const response = await app.handle(new Request("http://localhost/missing"));
    await afterResponse();

    expect(response.status).toBe(404);
    expect(parseLog(warn.mock.calls[0])).toMatchObject({
      path: "/missing",
      status: 404,
    });
  });

  test("logs failed route responses as errors", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = new Elysia()
      .use(requestLogger)
      .get("/failure", () => {
        throw new Error("request failed");
      });

    const response = await app.handle(new Request("http://localhost/failure"));
    await afterResponse();

    expect(response.status).toBe(500);
    expect(parseLog(error.mock.calls[0])).toMatchObject({
      path: "/failure",
      status: 500,
    });
  });

  test("logs early responses and redacts reset tokens without logging request data", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const app = new Elysia()
      .use(requestLogger)
      .onRequest(({ request }) => {
        if (request.url.endsWith("/early")) {
          logRequest(request, 413);
          return new Response("too large", { status: 413 });
        }
      })
      .post("/api/v1/auth/reset-password/:token", ({ body }) => body)
      .post("/early", () => "unreachable");
    const token = "secret-reset-token";
    const password = "secret-password";
    const authorization = "Bearer secret-session-token";

    const earlyResponse = await app.handle(
      new Request("http://localhost/early", { method: "POST" }),
    );
    await app.handle(
      new Request(`http://localhost/api/v1/auth/reset-password/${token}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization,
        },
        body: JSON.stringify({ newPassword: password }),
      }),
    );
    await afterResponse();

    expect(earlyResponse.status).toBe(413);
    expect(parseLog(warn.mock.calls[0])).toMatchObject({
      path: "/early",
      status: 413,
    });
    const logs = JSON.stringify([...info.mock.calls, ...warn.mock.calls]);
    expect(logs).toContain("/api/v1/auth/reset-password/:redacted");
    expect(logs).not.toContain(token);
    expect(logs).not.toContain(password);
    expect(logs).not.toContain(authorization);
  });
});
