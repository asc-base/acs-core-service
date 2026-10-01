import { fileTypeFromBuffer } from "file-type";
import { AppError } from "../../core/error/app-error";
import { ErrorCode } from "../../core/types/errors";

export const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function validateProfileImage(file: File) {
  if (file.size > MAX_PROFILE_IMAGE_SIZE) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Profile images must be 5 MiB or smaller",
      413,
    );
  }

  const detected = await fileTypeFromBuffer(new Uint8Array(await file.arrayBuffer()));
  if (!detected || !ALLOWED_IMAGE_TYPES.has(detected.mime)) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "Profile images must be JPEG, PNG, or WebP",
      415,
    );
  }

  return detected.mime;
}
