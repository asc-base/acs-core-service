import { ErrorCode } from "../types/errors";

export class AppError extends Error {
  constructor(
    public type: ErrorCode,
    public message: string,
    public statusCode: number = 400,
    public field?: string,
  ) {
    super(message);
  }
}
