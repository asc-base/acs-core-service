import { t, type Static } from "elysia";
import { ImageMediaPlain } from "../../../generated/prismabox/ImageMedia";
import { BaseModelSchema } from "../../../core/models";

export const ImageMediaSchema = t.Object({
  ...t.Pick(ImageMediaPlain, ["id", "provider", "imageUrl"]).properties,
  ...t.Partial(
    t.Pick(ImageMediaPlain, [
      "bucket",
      "fileKey",
      "fileName",
      "contentType",
      "fileSize",
    ]),
  ).properties,
  ...BaseModelSchema.properties,
});

export type ImageMedia = Static<typeof ImageMediaSchema>;
export type ImageMediaCreate = Omit<ImageMedia, "id">;
export type StoredImageMedia = Pick<
  ImageMediaCreate,
  "provider" | "bucket" | "fileKey" | "imageUrl"
> & {
  fileName?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
};
