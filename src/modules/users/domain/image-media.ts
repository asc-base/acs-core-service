import { t, type Static } from "elysia";

export const ImageMediaSchema = t.Object({
  id: t.Number(),
  provider: t.Union([
    t.Literal("rustfs"),
    t.Literal("supabase"),
    t.Literal("legacy_url"),
  ]),
  bucket: t.Optional(t.Nullable(t.String())),
  fileKey: t.Optional(t.Nullable(t.String())),
  imageUrl: t.String(),
  fileName: t.Optional(t.Nullable(t.String())),
  contentType: t.Optional(t.Nullable(t.String())),
  fileSize: t.Optional(t.Nullable(t.Number())),
});

export type ImageMedia = Static<typeof ImageMediaSchema>;
export type ImageMediaCreate = Omit<ImageMedia, "id">;
