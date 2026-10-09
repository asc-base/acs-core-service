import { hashPassword } from "better-auth/crypto";
import { CreateSuperUserDTO, UserDTO, UserProfileDTO } from "./domain/user";
import { IUserRepository } from "./domain/user.repository";
import { IUserFactory } from "./user.factory";
import { IUnitOfWork } from "../../core/uow/uow.interface";

export interface IUserService {
  createSuperUser(data: CreateSuperUserDTO): Promise<UserDTO>;
  getUsers(): Promise<UserDTO[]>;
  getUserById(id: number): Promise<UserDTO | null>;
  getUserProfile(id: number): Promise<UserProfileDTO | null>;
}

export class UserService implements IUserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly userFactory: IUserFactory,
    private readonly unitOfWork: IUnitOfWork,
  ) {}

  async createSuperUser(data: CreateSuperUserDTO): Promise<UserDTO> {
    const { password, ...userData } = data;
    const hashedPassword = await hashPassword(password);
    return this.unitOfWork.runInTransaction(async (tx) => {
      const user = await tx.user.createUser(userData);
      const userRole = await tx.user.assignUserRole({
        userID: user.id,
        roleID: 1,
      });

      if (!userRole) {
        throw new Error("Failed to assign superuser role");
      }

      await tx.auth.syncCredentialAccount(user.id, hashedPassword);

      return this.userFactory.mapUserToDTO(user);
    });
  }

  async getUsers(): Promise<UserDTO[]> {
    const users = await this.userRepository.getUsers();
    return this.userFactory.mapUserListToDTO(users);
  }

  async getUserById(id: number): Promise<UserDTO | null> {
    const user = await this.userRepository.getUserById(id);
    if (!user) {
      return null;
    }

    return this.userFactory.mapUserToDTO(user);
  }

  async getUserProfile(id: number): Promise<UserProfileDTO | null> {
    const user = await this.userRepository.getUserById(id);
    if (!user) {
      return null;
    }

    return this.userFactory.mapUserToProfileDTO(user);
  }
}
