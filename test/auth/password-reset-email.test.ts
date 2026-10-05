import { describe, expect, test } from "vitest";
import { createBetterAuthPasswordResetSender } from "../../src/lib/password-reset";
import {
  PasswordResetEmailMessage,
  renderPasswordResetEmail,
  sendPasswordResetEmail,
} from "../../src/lib/password-reset-email";

describe("password reset email", () => {
  test("renders the supplied template with escaped public URLs", async () => {
    const resetURL =
      "https://api.example.com/reset-password/token?callbackURL=https://app.example.com/reset-password";
    const html = await renderPasswordResetEmail({
      resetURL,
      logoURL: "https://cdn.example.com/acs-logo.png",
      illustrationURL: "https://cdn.example.com/forgot-password.png",
    });

    expect(html).toContain(
      "https://api.example.com/reset-password/token?callbackURL=https://app.example.com/reset-password",
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
