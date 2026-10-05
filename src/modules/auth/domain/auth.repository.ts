export interface IAuthRepository {
  syncCredentialAccount(userID: number, passwordHash: string): Promise<void>;
}
