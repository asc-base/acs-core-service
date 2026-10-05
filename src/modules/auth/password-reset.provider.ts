import { auth } from "../../lib/auth";

export interface IPasswordResetProvider {
  requestPasswordReset(input: {
    email: string;
    redirectTo: string;
    headers: Headers;
  }): Promise<void>;
  resetPassword(input: {
    token: string;
    newPassword: string;
    headers: Headers;
  }): Promise<void>;
}

export class BetterAuthPasswordResetProvider implements IPasswordResetProvider {
  async requestPasswordReset({
    email,
    redirectTo,
    headers,
  }: {
    email: string;
    redirectTo: string;
    headers: Headers;
  }): Promise<void> {
    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo,
      },
      headers,
    });
  }

  async resetPassword({
    token,
    newPassword,
    headers,
  }: {
    token: string;
    newPassword: string;
    headers: Headers;
  }): Promise<void> {
    await auth.api.resetPassword({
      body: {
        token,
        newPassword,
      },
      headers,
    });
  }
}
