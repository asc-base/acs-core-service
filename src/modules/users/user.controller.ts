import { Elysia } from "elysia";
import { UserService } from "./user.service";
import { UserRepository } from "../../infrastructure/user.repository";
import { prisma } from "../../lib/db";
import { User, UserProfileDTO } from "./domain/user";
import { success } from "../../core/interceptor/response";
import { userDocs } from "./user.docs";
import { UserFactory } from "./user.factory";
import { authMiddleware } from "../../middleware/auth";
import { HttpStatusCode } from "../../core/types/http";
import { AuthRepository } from "../../infrastructure/auth.repository";

const userFactory = new UserFactory();
const userRepository = new UserRepository(prisma);
const authRepository = new AuthRepository(prisma);
const userService = new UserService(
  userRepository,
  userFactory,
  authRepository,
);

export const userController = (app: Elysia) =>
  app.decorate("userService", userService).group("/users", (app) =>
    app
      .get(
        "",
        async ({ userService }) => {
          const users = await userService.getUsers();
          return success<User[]>(users, "Users retrieved successfully");
        },
        userDocs.getUsers,
      )
      .post(
        "/super-user",
        async ({ userService, body }) => {
          const newUser = await userService.createSuperUser(body);
          return success<User>(newUser, "Super user created successfully", 201);
        },
        userDocs.createUser,
      )
      .guard({}, (privateApp) =>
        privateApp.use(authMiddleware).get(
          "/profile",
          async ({ userID }: { userID: number }) => {
            const user = await userService.getUserProfile(userID);
            if (!user) {
              return success<null>(
                null,
                "User not found",
                HttpStatusCode.NOT_FOUND,
              );
            }
            return success<UserProfileDTO>(
              user,
              "User profile retrieved successfully",
            );
          },
          userDocs.getUserProfile,
        ),
      ),
  );
