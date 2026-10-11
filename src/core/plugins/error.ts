import Elysia from "elysia";
import { AppError } from "../error/app-error";

export const errorPlugin = (app: Elysia) =>
  app.onError(({ error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return {
        status: error.statusCode,
        data: null,
        msg: error.message,
        err: error.type,
      };
    }

    console.error("Unhandled API error", {
      type: error instanceof Error ? error.name : typeof error,
      code:
        error && typeof error === "object" && "code" in error
          ? error.code
          : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    });
  });
