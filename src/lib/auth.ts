import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { config } from "../core/config/config";
import { prisma } from "./db";
import {
  createBetterAuthPasswordResetSender,
  passwordResetRedirectOrigin,
} from "./password-reset";

const baseURL =
  process.env.BETTER_AUTH_URL ??
  `http://localhost:${config.APP_PORT}/api/v1/auth`;

const trustedOrigins = Array.from(
  new Set([
    ...(config.ALLOW_ORIGIN === "*"
      ? []
      : config.ALLOW_ORIGIN.split(",")
          .map((origin) => origin.trim())
          .filter(Boolean)),
    passwordResetRedirectOrigin,
  ]),
);

export const auth = betterAuth({
  appName: "ACS Core Service",
  baseURL,
  basePath: "/api/v1/auth",
  ...(process.env.BETTER_AUTH_SECRET || process.env.SECRET_JWT
    ? { secret: process.env.BETTER_AUTH_SECRET || process.env.SECRET_JWT }
    : {}),
  ...(trustedOrigins.length > 0 ? { trustedOrigins } : {}),
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  advanced: {
    database: {
      // The existing users table uses integer auto-incrementing IDs.
      generateId: "serial",
    },
    cookies: {
      // Keep the existing browser cookie contract while Better Auth signs it.
      session_token: {
        name: "accessToken",
      },
    },
  },
  user: {
    // Prisma's AuthUser model maps to auth.users (not public.users).
    modelName: "authUser",
  },
  session: {
    fields: {
      userId: "userID",
    },
  },
  account: {
    fields: {
      userId: "userID",
    },
  },
  emailAndPassword: {
    enabled: true,
    // User creation remains owned by the existing user module.
    disableSignUp: true,
    minPasswordLength: 4,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: createBetterAuthPasswordResetSender(),
  },
  // Application profile changes go through public.users and its sync trigger.
  disabledPaths: ["/update-user", "/delete-user"],
});
