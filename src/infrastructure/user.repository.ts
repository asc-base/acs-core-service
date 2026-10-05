import { IUserRepository } from "../modules/users/domain/user.repository";
import { PrismaInstance } from "../lib/db";
import {
  CreateUserModel,
  CreateUserRoleModel,
  UpdateUserModel,
  User,
  UserRole,
} from "../modules/users/domain/user";
import { Prisma } from "../generated/prisma/client";
import { AppError } from "../core/error/app-error";
import { ErrorCode } from "../core/types/errors";
import { HttpStatusCode } from "../core/types/http";

export class UserRepository implements IUserRepository {
  constructor(private readonly db: PrismaInstance) {}

  async createUser(data: CreateUserModel): Promise<User> {
    try {
      const user = await this.db.user.create({
        data: { ...data },
        include: { prefix: true, imageMedia: true },
      });
      return user as User;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(
          ErrorCode.DUPLICATE_DATA_ERROR,
          "A user with this email already exists",
          HttpStatusCode.CONFICLT_ERROR,
        );
      }
      throw error;
    }
  }

  async getUsers(): Promise<User[]> {
    const users = await this.db.user.findMany({
      include: { prefix: true, imageMedia: true },
    });
    return users as User[];
  }

  async assignUserRole(data: CreateUserRoleModel): Promise<UserRole> {
    const userRole = await this.db.userRole.create({ data });
    return userRole as UserRole;
  }

  async updateUser(userID: number, data: UpdateUserModel): Promise<User> {
    const updatedUser = await this.db.user.update({
      where: { id: userID, deletedAt: null },
      data,
      include: { prefix: true, imageMedia: true },
    });
    return updatedUser as User;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await this.db.user.findFirst({
      where: { email: email, deletedAt: null },
      include: {
        prefix: true,
        imageMedia: true,
        userRoles: {
          include: { role: true },
        }
      }
    });

    return user as User | null;
  }

  async getUserById(id: number): Promise<User | null> {
    try {
      const user = await this.db.user.findFirst({
        where: { id: id, deletedAt: null },
      include: {
        prefix: true,
        imageMedia: true,
        userRoles: {
            include: { role: true },
          }
        }
      });

      return user as User | null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return null;
        }
      }
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        "Database error occurred",
        HttpStatusCode.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
