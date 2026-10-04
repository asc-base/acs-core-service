import { fileTypeFromBuffer } from "file-type";
import { AppError } from "../../core/error/app-error";
import { ErrorCode } from "../../core/types/errors";

export async function detectImageContentTypeFromBytes(bytes: Uint8Array) {
  const type = await fileTypeFromBuffer(bytes);
  if (type?.mime.startsWith("image/")) return type.mime;

  const header = Buffer.from(bytes.subarray(0, 4096)).toString("utf8").trimStart();
  if (/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(header)) return "image/svg+xml";

  throw new AppError(ErrorCode.VALIDATION_ERROR, "Uploaded file must contain a supported image", 415);
}

export async function detectImageContentType(file: File) {
  return detectImageContentTypeFromBytes(new Uint8Array(await file.arrayBuffer()));
}
