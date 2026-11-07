import { t, Static } from "elysia";
import { BaseModelSchema, CommonQueryParams } from "../../../core/models";
import type { StoredImageMedia } from "../../users/domain/image-media";
import { ImageMediaSchema } from "../../users/domain/image-media";
import { CurriculumPlain } from "../../../generated/prismabox/Curriculum";

const FocalPointInputFields = {
  thumbnailFocalPointX: t.Optional(t.Numeric()),
  thumbnailFocalPointY: t.Optional(t.Numeric()),
};

const FocalPointResponseFields = {
  thumbnailFocalPointX: t.Optional(t.Nullable(t.Number())),
  thumbnailFocalPointY: t.Optional(t.Nullable(t.Number())),
};

export const CommonCurriculumField = {
  ...t.Pick(CurriculumPlain, ["title", "year", "documentURL", "description"])
    .properties,
};

export const CurriculumSchema = t.Object({
  ...t.Pick(CurriculumPlain, ["id", "thumbnailURL"]).properties,
  imageID: t.Optional(CurriculumPlain.properties.imageID),
  thumbnailContentType: t.Optional(t.Nullable(t.String())),
  imageMedia: t.Optional(t.Nullable(ImageMediaSchema)),
  ...CommonCurriculumField,
  ...FocalPointResponseFields,
  ...BaseModelSchema.properties,
});

export const CreateCurriculumDTO = t.Object({
  thumbnailFile: t.File(),
  ...CommonCurriculumField,
  ...FocalPointInputFields,
});

export const CurriculumDTO = t.Object({
  ...t.Pick(CurriculumPlain, ["id", "thumbnailURL"]).properties,
  thumbnailContentType: t.Optional(t.Nullable(t.String())),
  ...CommonCurriculumField,
  ...FocalPointResponseFields,
});

export const CurriculumQueryParams = t.Object({
  ...CommonQueryParams,
  year: t.Optional(t.String()),
});

export const CurriculumIdParam = t.Object({
  id: t.Number(),
});

export const UpdateCurriculumDTO = t.Partial(
  t.Object({
    thumbnailFile: t.File(),
    ...CommonCurriculumField,
    ...FocalPointInputFields,
  }),
);

export const CurriculumCreatePayloadSchema = t.Object({
  ...t.Pick(CurriculumPlain, [
    "title",
    "year",
    "documentURL",
    "description",
    "thumbnailURL",
  ]).properties,
  ...FocalPointInputFields,
});

export const CurriculumUpdatePayloadSchema = t.Partial(
  t.Object({
    ...t.Pick(CurriculumPlain, [
      "title",
      "year",
      "documentURL",
      "description",
      "thumbnailURL",
    ]).properties,
    ...FocalPointInputFields,
  }),
);

export type CurriculumCreatePayload = Static<
  typeof CurriculumCreatePayloadSchema
> & { thumbnailMedia?: StoredImageMedia };
export type CurriculumUpdatePayload = Static<
  typeof CurriculumUpdatePayloadSchema
> & { thumbnailMedia?: StoredImageMedia };
export type Curriculum = Static<typeof CurriculumSchema>;
export type CreateCurriculumDTO = Static<typeof CreateCurriculumDTO>;
export type CurriculumDTO = Static<typeof CurriculumDTO>;
export type CurriculumQueryParams = Static<typeof CurriculumQueryParams>;
export type CurriculumIdParam = Static<typeof CurriculumIdParam>;
export type UpdateCurriculumDTO = Static<typeof UpdateCurriculumDTO>;
