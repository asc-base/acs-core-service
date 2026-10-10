import { afterEach, describe, expect, test, vi } from "vitest";
import { createBetterAuthPasswordResetSender } from "../../src/lib/password-reset";
import {
  PasswordResetEmailMessage,
  renderPasswordResetEmail,
  sendPasswordResetEmail,
} from "../../src/lib/password-reset-email";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("password reset email", () => {
  test("defaults the reset callback to the auth page", async () => {
    vi.stubEnv("FRONTEND_RESET_PASSWORD_URL", undefined);
    vi.resetModules();

    const { passwordResetRedirectURL } = await import("../../src/lib/password-reset");

    expect(passwordResetRedirectURL).toBe(
      "http://localhost:3000/auth/reset-password",
    );
  });

  test("uses the configured reset callback URL", async () => {
    vi.stubEnv(
      "FRONTEND_RESET_PASSWORD_URL",
      "https://portal.example.com/auth/reset-password",
    );
    vi.resetModules();

    const { passwordResetRedirectURL } = await import("../../src/lib/password-reset");

    expect(passwordResetRedirectURL).toBe(
      "https://portal.example.com/auth/reset-password",
    );
  });

  test("renders the supplied template with escaped public URLs", async () => {
    const resetURL =
      "https://api.example.com/reset-password/token?callbackURL=https://app.example.com/auth/reset-password";
    const html = await renderPasswordResetEmail({
      resetURL,
      logoURL: "https://cdn.example.com/acs-logo.png",
      illustrationURL: "https://cdn.example.com/forgot-password.png",
    });

    expect(html).toContain(
      "https://api.example.com/reset-password/token?callbackURL=https://app.example.com/auth/reset-password",
    );
    expect(html).toContain("https://cdn.example.com/acs-logo.png");
    expect(html).toContain("https://cdn.example.com/forgot-password.png");
    expect(html).not.toContain("{{RESET_PASSWORD_URL}}");
  });

  test("sends the rendered template to the requested email address", async () => {
    const resetURL = "https://api.example.com/reset-password/token";
    let message: PasswordResetEmailMessage | undefined;

    await sendPasswordResetEmail(
      {
        email: "user@example.com",
        resetURL,
        from: "noreply@example.com",
      },
      {
        sendMail: async (input) => {
          message = input;
        },
      },
    );

    expect(message?.to).toBe("user@example.com");
    expect(message?.subject).toBe("Reset your ACS password");
    expect(message?.text).toContain(resetURL);
    expect(message?.html).toContain(resetURL);
  });

  test("waits for Better Auth reset-email delivery and propagates failures", async () => {
    const deliveryError = new Error("SMTP rejected the message");
    const sendResetPassword = createBetterAuthPasswordResetSender(async () => {
      throw deliveryError;
    });

    await expect(
      sendResetPassword({
        user: { email: "user@example.com" },
        url: "https://api.example.com/reset-password/token",
      }),
    ).rejects.toBe(deliveryError);
  });
});
