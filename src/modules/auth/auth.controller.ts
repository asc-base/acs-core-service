import Elysia, { type HTTPHeaders } from "elysia";
import { AuthService } from "./auth.service";
import { authDocs } from "./auth.docs";
import { HttpStatusCode } from "../../core/types/http";
import { success } from "../../core/interceptor/response";
import { auth } from "../../lib/auth";
import { passwordResetRedirectURL } from "../../lib/password-reset";
import { BetterAuthPasswordResetProvider } from "./password-reset.provider";
import { UserRepository } from "../../infrastructure/user.repository";
import { prisma } from "../../lib/db";

const forwardSetCookies = (
  set: { headers: HTTPHeaders },
  headers?: Headers,
) => {
  if (!headers) {
    return;
  }

  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;
  const cookies = getSetCookie?.call(headers) ?? [];
  const fallbackCookie = headers.get("set-cookie");
  const responseHeaders = set.headers as HTTPHeaders & {
    "set-cookie"?: string | string[];
  };

  if (cookies.length > 0) {
    responseHeaders["set-cookie"] = cookies;
  } else if (fallbackCookie) {
    responseHeaders["set-cookie"] = fallbackCookie;
  }
};

export const authService = new AuthService(
  new BetterAuthPasswordResetProvider(),
  passwordResetRedirectURL,
  new UserRepository(prisma),
);
export const AuthController = (app: Elysia) =>
  app.group("/auth", (app) =>
    app
      .decorate("authService", authService)
      .post(
        "/login",
        async ({ body, set, request }) => {
          const result = await auth.api.signInEmail({
            body,
            headers: request.headers,
            returnHeaders: true,
            returnStatus: true,
          });
          const response = result.response;
          const token =
            response && typeof response === "object" && "token" in response
              ? response.token
              : null;

          if (!token) {
            throw new Error("Failed to create Better Auth session");
          }

          forwardSetCookies(set, result.headers);

          set.status = HttpStatusCode.OK;
          set.headers["content-type"] = "application/json";
          return success(
            { accessToken: token, refreshToken: token },
            "Authenticated successfully",
            HttpStatusCode.OK,
          );
        },
        authDocs.login,
      )
      .post(
        "/logout",
        async ({ request, set }) => {
          const result = await auth.api.signOut({
            headers: request.headers,
            returnHeaders: true,
            returnStatus: true,
          });
          forwardSetCookies(set, result.headers);
          set.status = HttpStatusCode.OK;
          return success(null, "Logged out successfully", HttpStatusCode.OK);
        },
        authDocs.logout,
      )
      .post(
        "/credentials",
        async ({ body, request, set }) => {
          await authService.createCredentials(body, request.headers);
          set.status = HttpStatusCode.OK;
          return success(
            null,
            "If this email exists, password reset instructions will be sent",
            HttpStatusCode.OK,
          );
        },
        authDocs.createCredentials,
      )
      .post(
        "/reset-password/:token",
        async ({ params, body, request, set }) => {
          await authService.resetPassword(params.token, body, request.headers);
          set.status = HttpStatusCode.OK;
          return success(
            null,
            "Reset password successfully",
            HttpStatusCode.OK,
          );
        },
        authDocs.resetPassword,
      ),
  );
