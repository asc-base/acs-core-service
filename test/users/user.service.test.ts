import { describe, expect, test, vi } from "vitest";
import { verifyPassword } from "better-auth/crypto";
import {
  CreateUserModel,
  CreateSuperUserDTO,
  User,
  UserRole,
} from "../../src/modules/users/domain/user";
import { IUserRepository } from "../../src/modules/users/domain/user.repository";
import { IAuthRepository } from "../../src/modules/auth/domain/auth.repository";
import { IUnitOfWork } from "../../src/core/uow/uow.interface";
import { UserFactory } from "../../src/modules/users/user.factory";
import { UserService } from "../../src/modules/users/user.service";

describe("UserService.createSuperUser", () => {
  test("stores the password in Better Auth credentials, not the user profile", async () => {
    const password = "P@ssw0rd";
    const user = createUser();
    let createdUser: CreateUserModel | undefined;
    let assignedRole: { userID: number; roleID: number } | undefined;
    let credential: { userID: number; passwordHash: string } | undefined;

    const userRepository: IUserRepository = {
      createUser: async (data) => {
        createdUser = data;
        return user;
      },
      getUsers: async () => [],
      assignUserRole: async (data) => {
        assignedRole = data;
        return {} as UserRole;
      },
      updateUser: async () => user,
      getUserByEmail: async () => null,
      getUserById: async () => null,
    };
    const authRepository: IAuthRepository = {
      syncCredentialAccount: async (userID, passwordHash) => {
        credential = { userID, passwordHash };
      },
    };
    const unitOfWork = createUnitOfWork(userRepository, authRepository);
    const service = new UserService(userRepository, new UserFactory(), unitOfWork);

    const result = await service.createSuperUser(createSuperUserData(password));

    expect(createdUser).toEqual({
      firstNameTh: "ผู้ดูแล",
      lastNameTh: "ระบบ",
      firstNameEn: "System",
      lastNameEn: "Administrator",
      email: "admin@example.com",
      nickName: "admin",
    });
    expect(createdUser).not.toHaveProperty("password");
    expect(unitOfWork.runInTransaction).toHaveBeenCalledOnce();
    expect(assignedRole).toEqual({
      userID: user.id,
      roleID: 1,
    });
    expect(credential?.userID).toBe(user.id);
    expect(
      await verifyPassword({
        password,
        hash: credential?.passwordHash ?? "",
      }),
    ).toBe(true);
    expect(result).toEqual({
      id: user.id,
      prefix: null,
      firstNameTh: user.firstNameTh,
      lastNameTh: user.lastNameTh,
      firstNameEn: user.firstNameEn,
      lastNameEn: user.lastNameEn,
      email: user.email,
      nickName: user.nickName,
      imageUrl: user.imageUrl,
      imageFocalPointX: null,
      imageFocalPointY: null,
    });
  });

  test.each(["role assignment", "credential write"])(
    "propagates a %s failure from the transaction",
    async (failurePoint) => {
      const failure = new Error(`${failurePoint} failed`);
      const user = createUser();
      const userRepository: IUserRepository = {
        createUser: vi.fn(async () => user),
        getUsers: async () => [],
        assignUserRole: vi.fn(async () => {
          if (failurePoint === "role assignment") throw failure;
          return {} as UserRole;
        }),
        updateUser: async () => user,
        getUserByEmail: async () => null,
        getUserById: async () => null,
      };
      const authRepository: IAuthRepository = {
        syncCredentialAccount: vi.fn(async () => {
          if (failurePoint === "credential write") throw failure;
        }),
      };
      const unitOfWork = createUnitOfWork(userRepository, authRepository);
      const service = new UserService(userRepository, new UserFactory(), unitOfWork);

      await expect(
        service.createSuperUser(createSuperUserData("P@ssw0rd")),
      ).rejects.toBe(failure);
      expect(unitOfWork.runInTransaction).toHaveBeenCalledOnce();
      expect(authRepository.syncCredentialAccount).toHaveBeenCalledTimes(
        failurePoint === "credential write" ? 1 : 0,
      );
    },
  );
});

describe("UserService.getUserProfile", () => {
  test("returns roles as an array without role audit timestamps", async () => {
    const user = {
      ...createUser(),
      userRoles: [
        {
          id: 7,
          userID: 42,
          roleID: 1,
          role: {
            id: 1,
            name: "SUPER_ADMIN",
            createdAt: new Date("2026-08-01T00:00:00.000Z"),
            updatedAt: new Date("2026-08-01T00:00:00.000Z"),
            deletedAt: null,
          },
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          updatedAt: new Date("2026-08-01T00:00:00.000Z"),
          deletedAt: null,
        },
      ],
    } as unknown as User;
    const userRepository: IUserRepository = {
      createUser: async () => user,
      getUsers: async () => [],
      assignUserRole: async () => ({} as UserRole),
      updateUser: async () => user,
      getUserByEmail: async () => null,
      getUserById: async () => user,
    };
    const service = new UserService(
      userRepository,
      new UserFactory(),
      createUnitOfWork(userRepository, { syncCredentialAccount: async () => undefined }),
    );

    await expect(service.getUserProfile(user.id)).resolves.toEqual({
      id: user.id,
      prefix: null,
      firstNameTh: user.firstNameTh,
      lastNameTh: user.lastNameTh,
      firstNameEn: user.firstNameEn,
      lastNameEn: user.lastNameEn,
      email: user.email,
      nickName: user.nickName,
      imageUrl: user.imageUrl,
      imageFocalPointX: null,
      imageFocalPointY: null,
      roles: [{ id: 1, name: "SUPER_ADMIN" }],
    });
  });
});

const createUnitOfWork = (
  user: IUserRepository,
  auth: IAuthRepository,
): IUnitOfWork =>
  ({
    runInTransaction: vi.fn((fn: (uow: IUnitOfWork) => Promise<unknown>) =>
      fn({ user, auth } as IUnitOfWork),
    ),
  }) as unknown as IUnitOfWork;

const createSuperUserData = (password: string): CreateSuperUserDTO => ({
  firstNameTh: "ผู้ดูแล",
  lastNameTh: "ระบบ",
  firstNameEn: "System",
  lastNameEn: "Administrator",
  email: "admin@example.com",
  nickName: "admin",
  password,
});

const createUser = (): User => {
  const now = new Date("2026-08-01T00:00:00.000Z");

  return {
    id: 42,
    firstNameTh: "ผู้ดูแล",
    lastNameTh: "ระบบ",
    firstNameEn: "System",
    lastNameEn: "Administrator",
    email: "admin@example.com",
    nickName: "admin",
    imageUrl: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
};
