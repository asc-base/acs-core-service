import { Elysia } from "elysia";

const requestStartedAt = new WeakMap<Request, number>();

const requestPath = (request: Request) =>
  new URL(request.url).pathname.replace(
    /(\/auth\/reset-password\/)[^/]+(?=\/|$)/,
    "$1:redacted",
  );

export const logRequest = (request: Request, status: number) => {
  const now = performance.now();
  const startedAt = requestStartedAt.get(request) ?? now;
  const entry = JSON.stringify({
    type: "http.request",
    method: request.method,
    path: requestPath(request),
    status,
    durationMs: Math.round(now - startedAt),
  });

  if (status >= 500) {
    console.error(entry);
  } else if (status >= 400) {
    console.warn(entry);
  } else {
    console.info(entry);
  }
};

export const requestLogger = (app: Elysia) =>
  app
    .onRequest(({ request }) => {
      requestStartedAt.set(request, performance.now());
    })
    .onAfterResponse(({ request, responseValue, set }) => {
      const status =
        responseValue instanceof Response
          ? responseValue.status
          : typeof set.status === "number"
            ? set.status
            : 200;

      logRequest(request, status);
    });
