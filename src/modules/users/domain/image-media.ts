import { t, type Static } from "elysia";

export const ImageMediaSchema = t.Object({
  id: t.Number(),
  provider: t.String(),
  bucket: t.Optional(t.Nullable(t.String())),
  fileKey: t.Optional(t.Nullable(t.String())),
  imageUrl: t.String(),
  fileName: t.Optional(t.Nullable(t.String())),
  contentType: t.Optional(t.Nullable(t.String())),
  fileSize: t.Optional(t.Nullable(t.Number())),
});

export type ImageMedia = Static<typeof ImageMediaSchema>;
export type ImageMediaCreate = Omit<ImageMedia, "id">;
export type StoredImageMedia = Pick<ImageMediaCreate, "provider" | "bucket" | "fileKey" | "imageUrl"> & {
  fileName?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
};
