import { t } from "elysia";
import {
  AuthRequestDTO,
  AuthResponseDTO,
  CreateCredentialsDTO,
} from "./domain/auth";
import { mapResponse } from "../../core/interceptor/response";

export const authDocs = {
  login: {
    detail: {
      description: "Authenticate a user and return an access token",
      summary: "User login",
      tags: ["Auth"],
    },
    body: AuthRequestDTO,
    response: {
      200: mapResponse(AuthResponseDTO),
    },
  },
  logout: {
    detail: {
      description: "Logout a user by clearing the access token cookie",
      summary: "User logout",
      tags: ["Auth"],
    },
  },
  createCredentials: {
    detail: {
      description:
        "Request a Better Auth password reset link without exposing its token",
      summary: "Request password reset",
      tags: ["Auth"],
    },
    body: CreateCredentialsDTO,
  },
  resetPassword: {
    detail: {
      description: "Reset the user's password using a Better Auth reset token",
      summary: "Reset password",
      tags: ["Auth"],
    },
    params: t.Object({
      token: t.String({
        description: "The Better Auth reset token received by the frontend",
        examples: ["abc123def456"],
      }),
    }),
    body: t.Object({
      newPassword: t.String({
        description: "The new password for the user",
        examples: ["newSecurePassword123"],
      }),
    }),
  },
};
