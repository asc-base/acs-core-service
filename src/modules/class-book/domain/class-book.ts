import { t, Static } from "elysia";
import { BaseModelSchema, CommonQueryParams } from "../../../core/models";
import {
  CurriculumSchema,
  CurriculumDTO,
} from "../../curriculums/domain/curriculum";
import type { StoredImageMedia } from "../../users/domain/image-media";
import { ImageMediaSchema } from "../../users/domain/image-media";
import { ClassBookPlain } from "../../../generated/prismabox/ClassBook";

export const CommonClassBookFields = {
  ...t.Pick(ClassBookPlain, ["classof", "firstYearAcademic"]).properties,
};

export const FocalPointFields = {
  imageFocalPointX: t.Optional(t.Nullable(t.Numeric())),
  imageFocalPointY: t.Optional(t.Nullable(t.Numeric())),
};

export const ClassBookSchema = t.Object({
  ...t.Pick(ClassBookPlain, ["id", "thumbnailURL", "curriculumID"]).properties,
  ...CommonClassBookFields,
  thumbnailContentType: t.Optional(t.Nullable(t.String())),
  imageID: t.Optional(t.Nullable(ClassBookPlain.properties.imageID)),
  imageMedia: t.Optional(t.Nullable(ImageMediaSchema)),
  ...FocalPointFields,
  curriculum: CurriculumSchema,
  ...BaseModelSchema.properties,
});

export const CreateClassBookDTO = t.Object({
  ...CommonClassBookFields,
  ...FocalPointFields,
  thumbnailFile: t.File(),
  curriculumID: t.Numeric(),
});

export const ClassBookQueryParams = t.Object({
  ...CommonQueryParams,
  search: t.Optional(t.String()),
  searchBy: t.Optional(t.String()),
  curriculumID: t.Optional(t.Number()),
});

export const ClassBookDTO = t.Object({
  ...t.Pick(ClassBookPlain, ["id", "thumbnailURL", "curriculumID"]).properties,
  ...CommonClassBookFields,
  thumbnailContentType: t.Optional(t.Nullable(t.String())),
  ...FocalPointFields,
  curriculum: CurriculumDTO,
});

export const UpdateClassBookDTO = t.Partial(
  t.Object({
    ...CommonClassBookFields,
    ...FocalPointFields,
    thumbnailFile: t.File(),
    curriculumID: t.Numeric(),
  }),
);

export const ClassBookCreatePayloadSchema = t.Object({
  ...t.Pick(ClassBookPlain, ["classof", "firstYearAcademic", "thumbnailURL"])
    .properties,
  ...FocalPointFields,
  curriculumID: t.Number(),
});

export const ClassBookUpdatePayloadSchema = t.Partial(
  t.Object({
    ...t.Pick(ClassBookPlain, ["classof", "firstYearAcademic", "thumbnailURL"])
      .properties,
    ...FocalPointFields,
    curriculumID: t.Number(),
  }),
);

export type ClassBook = Static<typeof ClassBookSchema>;
export type ClassBookDTO = Static<typeof ClassBookDTO>;
export type CreateClassBookDTO = Static<typeof CreateClassBookDTO>;
export type ClassBookQueryParams = Static<typeof ClassBookQueryParams>;
export type UpdateClassBookDTO = Static<typeof UpdateClassBookDTO>;
export type ClassBookCreatePayload = Static<
  typeof ClassBookCreatePayloadSchema
> & { thumbnailMedia?: StoredImageMedia };
export type ClassBookUpdatePayload = Static<
  typeof ClassBookUpdatePayloadSchema
> & { thumbnailMedia?: StoredImageMedia };
