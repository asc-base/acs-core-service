import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { openapi } from "@elysiajs/openapi";
import { responseEnhancer } from "../core/interceptor/response";
import { openapiConfig } from "./openapi.config";
import { RouteSetup } from "../routes/routes";
import { errorPlugin } from "../core/plugins/error";
import { cors } from "@elysiajs/cors";
import { config } from "../core/config/config";
import { auth } from "../lib/auth";
import { logRequest, requestLogger } from "../core/plugins/request-logger";
export class Server {
  constructor(
    private readonly port: number,
    private readonly hostname: string,
  ) {}
  start() {
    const app = (process.versions.bun
      ? new Elysia({ prefix: "/api" })
      : new Elysia({ adapter: node(), prefix: "/api" }))
      .use(openapi(openapiConfig))
      .use(responseEnhancer)
      .use(errorPlugin)
      .use(requestLogger)
      .use(
        cors({
          origin:
            config.ALLOW_ORIGIN === "*"
              ? true
              : config.ALLOW_ORIGIN.split(",").map((o) => o.trim()),
          methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
          allowedHeaders: ["Content-Type", "Authorization"],
          credentials: true,
        }),
      )
      .onRequest(({ request }) => {
        const { pathname } = new URL(request.url);
        const isNewsUpload = (request.method === "POST" && pathname === "/api/v1/news")
          || (request.method === "PATCH" && /^\/api\/v1\/news\/\d+$/.test(pathname));
        const contentLength = Number(request.headers.get("content-length"));
        if (isNewsUpload && contentLength > 64 * 1024 * 1024) {
          logRequest(request, 413);
          return new Response("News uploads are limited to 64 MiB", { status: 413 });
        }
      })
      .mount(auth.handler)
      .use(RouteSetup);

    app.listen({ port: this.port, hostname: this.hostname }, () => {
      console.log(
        `🦊 Elysia is running at ${this.hostname}:${this.port} (${process.versions.bun ? "Bun" : "Node.js"})`,
      );
    });
  }
}
