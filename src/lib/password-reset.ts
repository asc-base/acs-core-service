import { config } from "../core/config/config";
import {
  isPasswordResetEmailConfigured,
  sendPasswordResetEmail,
} from "./password-reset-email";

const configuredRedirectURL =
  process.env.FRONTEND_RESET_PASSWORD_URL ??
  "http://localhost:3000/reset-password";

if (config.ENVIRONMENT === "production" && !isPasswordResetEmailConfigured()) {
  throw new Error(
    "MAIL_HOST, MAIL_USER, MAIL_PASS, and MAIL_FROM must be configured in production",
  );
}

export const passwordResetRedirectURL = new URL(
  configuredRedirectURL,
).toString();
export const passwordResetRedirectOrigin = new URL(passwordResetRedirectURL)
  .origin;

export const sendPasswordResetLink = async ({
  email,
  url,
}: {
  email: string;
  url: string;
}): Promise<void> => {
  await sendPasswordResetEmail({
    email,
    resetURL: url,
  });
};

export const createBetterAuthPasswordResetSender =
  (sendResetLink: typeof sendPasswordResetLink = sendPasswordResetLink) =>
  async ({
    user,
    url,
  }: {
    user: { email: string };
    url: string;
  }): Promise<void> => {
    await sendResetLink({
      email: user.email,
      url,
    });
  };
