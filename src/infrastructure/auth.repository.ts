import { PrismaClient } from "../generated/prisma/client";
import { IAuthRepository } from "../modules/auth/domain/auth.repository";

export class AuthRepository implements IAuthRepository {
  constructor(private readonly db: PrismaClient) {}

  async syncCredentialAccount(
    userID: number,
    passwordHash: string,
  ): Promise<void> {
    await this.db.account.upsert({
      where: {
        providerId_accountId: {
          providerId: "credential",
          accountId: String(userID),
        },
      },
      create: {
        userID,
        accountId: String(userID),
        providerId: "credential",
        password: passwordHash,
      },
      update: {
        password: passwordHash,
      },
    });
  }
}
