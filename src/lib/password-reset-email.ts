import { readFile } from "node:fs/promises";
import nodemailer from "nodemailer";

const resetPasswordTemplateURL = new URL(
  "../template/reset-password.html",
  import.meta.url,
);

export interface PasswordResetEmailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface PasswordResetEmailTransport {
  sendMail(message: PasswordResetEmailMessage): Promise<unknown>;
}

const escapeHTML = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const requiredEnvironmentValue = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} must be configured to send password reset emails`);
  }

  return value;
};

export const isPasswordResetEmailConfigured = () =>
  Boolean(
    process.env.MAIL_HOST &&
      process.env.MAIL_USER &&
      process.env.MAIL_PASS &&
      process.env.MAIL_FROM,
  );

export const renderPasswordResetEmail = async ({
  resetURL,
  logoURL = process.env.MAIL_RESET_PASSWORD_LOGO_URL ?? "",
  illustrationURL = process.env.MAIL_RESET_PASSWORD_ILLUSTRATION_URL ?? "",
}: {
  resetURL: string;
  logoURL?: string;
  illustrationURL?: string;
}): Promise<string> => {
  const template = await readFile(resetPasswordTemplateURL, "utf8");

  return template
    .replaceAll("{{RESET_PASSWORD_URL}}", escapeHTML(resetURL))
    .replaceAll("{{MAIL_RESET_PASSWORD_LOGO_URL}}", escapeHTML(logoURL))
    .replaceAll(
      "{{MAIL_RESET_PASSWORD_ILLUSTRATION_URL}}",
      escapeHTML(illustrationURL),
    );
};

export const createPasswordResetEmailTransport =
  (): PasswordResetEmailTransport =>
    nodemailer.createTransport({
    host: requiredEnvironmentValue("MAIL_HOST"),
    port: Number.parseInt(process.env.MAIL_PORT ?? "587", 10),
    secure: process.env.MAIL_SECURE === "true",
    auth: {
      user: requiredEnvironmentValue("MAIL_USER"),
      pass: requiredEnvironmentValue("MAIL_PASS"),
      },
    });

export const sendPasswordResetEmail = async (
  {
    email,
    resetURL,
    from = process.env.MAIL_FROM,
  }: {
    email: string;
    resetURL: string;
    from?: string;
  },
  transport: PasswordResetEmailTransport = createPasswordResetEmailTransport(),
): Promise<void> => {
  const html = await renderPasswordResetEmail({ resetURL });

  await transport.sendMail({
    from: from ?? requiredEnvironmentValue("MAIL_FROM"),
    to: email,
    subject: "Reset your ACS password",
    text: `เราได้รับคำขอเปลี่ยนรหัสผ่านสำหรับบัญชีของคุณ\n\nเปลี่ยนรหัสผ่าน: ${resetURL}`,
    html,
  });
};
