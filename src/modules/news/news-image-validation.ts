import { fileTypeFromBuffer } from "file-type";
import { AppError } from "../../core/error/app-error";
import { ErrorCode } from "../../core/types/errors";

export const MAX_NEWS_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function validateNewsImage(file: File) {
  if (file.size > MAX_NEWS_IMAGE_SIZE) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "News images must be 5 MiB or smaller", 413);
  }
  const type = await fileTypeFromBuffer(new Uint8Array(await file.arrayBuffer()));
  if (!type || !ALLOWED_TYPES.has(type.mime)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "News images must be JPEG, PNG, or WebP", 415);
  }
  return type.mime;
}
