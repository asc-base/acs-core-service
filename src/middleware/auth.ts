import Elysia from "elysia";
import { AppError } from "../core/error/app-error";
import { ErrorCode } from "../core/types/errors";
import { HttpStatusCode } from "../core/types/http";
import { auth } from "../lib/auth";
import { prisma } from "../lib/db";

export const authMiddleware = (app: Elysia) =>
  app.derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session) {
      throw new AppError(
        ErrorCode.AUTHENTICATION_ERROR,
        "Unauthorized",
        HttpStatusCode.UNAUTHORIZED,
      );
    }

    const userID = Number(session.user.id);
    if (!Number.isSafeInteger(userID)) {
      throw new AppError(
        ErrorCode.AUTHENTICATION_ERROR,
        "Invalid session",
        HttpStatusCode.UNAUTHORIZED,
      );
    }

    const userRecord = await prisma.user.findFirst({
      where: { id: userID, deletedAt: null },
      include: {
        userRoles: {
          include: { role: true },
        },
      },
    });

    if (!userRecord) {
      throw new AppError(
        ErrorCode.AUTHENTICATION_ERROR,
        "Unauthorized",
        HttpStatusCode.UNAUTHORIZED,
      );
    }

    const user = {
      userID,
      roles: userRecord.userRoles.map((userRole) => userRole.role.name),
    };

    return user;
  });
