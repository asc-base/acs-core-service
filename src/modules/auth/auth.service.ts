import { AppError } from "../../core/error/app-error";
import { ErrorCode } from "../../core/types/errors";
import { HttpStatusCode } from "../../core/types/http";
import { IUserRepository } from "../users/domain/user.repository";
import { CreateCredentialsDTO, ResetPasswordDTO } from "./domain/auth";
import { IPasswordResetProvider } from "./password-reset.provider";

export interface IAuthService {
  createCredentials(
    data: CreateCredentialsDTO,
    headers: Headers,
  ): Promise<void>;
  resetPassword(
    token: string,
    data: ResetPasswordDTO,
    headers: Headers,
  ): Promise<void>;
}

export class AuthService implements IAuthService {
  constructor(
    private readonly passwordResetProvider: IPasswordResetProvider,
    private readonly passwordResetRedirectURL: string,
    private readonly userRepository: IUserRepository,
  ) {}

  async createCredentials(
    data: CreateCredentialsDTO,
    headers: Headers,
  ): Promise<void> {
    const user = await this.userRepository.getUserByEmail(data.email);

    if (!user) {
      throw new AppError(
        ErrorCode.NOT_FOUND_ERROR,
        "User not found",
        HttpStatusCode.NOT_FOUND,
      );
    }

    await this.passwordResetProvider.requestPasswordReset({
      email: data.email,
      redirectTo: this.passwordResetRedirectURL,
      headers,
    });
  }

  async resetPassword(
    token: string,
    data: ResetPasswordDTO,
    headers: Headers,
  ): Promise<void> {
    await this.passwordResetProvider.resetPassword({
      token,
      newPassword: data.newPassword,
      headers,
    });
  }
}
