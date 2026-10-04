import { t, Static } from "elysia";
import { BaseModelSchema, CommonQueryParams } from "../../../core/models";
import {
  CurriculumSchema,
  CurriculumDTO,
} from "../../curriculums/domain/curriculum";
import type { StoredImageMedia } from "../../users/domain/image-media";
import { ImageMediaSchema } from "../../users/domain/image-media";

export const CommonClassBookFields = {
  classof: t.String(),
  firstYearAcademic: t.String(),
};

export const FocalPointFields = {
  imageFocalPointX: t.Optional(t.Nullable(t.Numeric())),
  imageFocalPointY: t.Optional(t.Nullable(t.Numeric())),
};

export const ClassBookSchema = t.Intersect([
  t.Object({
    id: t.Number(),
    ...CommonClassBookFields,
    thumbnailURL: t.String(),
    thumbnailContentType: t.Optional(t.Nullable(t.String())),
    imageMedia: t.Optional(t.Nullable(ImageMediaSchema)),
    ...FocalPointFields,
    curriculumID: t.Number(),
    curriculum: CurriculumSchema,
  }),
  BaseModelSchema,
]);

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
  id: t.Number(),
  ...CommonClassBookFields,
  thumbnailURL: t.String(),
  thumbnailContentType: t.Optional(t.Nullable(t.String())),
  ...FocalPointFields,
  curriculumID: t.Number(),
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
  classof: t.String(),
  firstYearAcademic: t.String(),
  thumbnailURL: t.String(),
  ...FocalPointFields,
  curriculumID: t.Number(),
});

export const ClassBookUpdatePayloadSchema = t.Partial(
  t.Object({
    classof: t.String(),
    firstYearAcademic: t.String(),
    thumbnailURL: t.String(),
    ...FocalPointFields,
    curriculumID: t.Number(),
  }),
);

export type ClassBook = Static<typeof ClassBookSchema>;
export type ClassBookDTO = Static<typeof ClassBookDTO>;
export type CreateClassBookDTO = Static<typeof CreateClassBookDTO>;
export type ClassBookQueryParams = Static<typeof ClassBookQueryParams>;
export type UpdateClassBookDTO = Static<typeof UpdateClassBookDTO>;
export type ClassBookCreatePayload = Static<typeof ClassBookCreatePayloadSchema> & { thumbnailMedia?: StoredImageMedia };
export type ClassBookUpdatePayload = Static<typeof ClassBookUpdatePayloadSchema> & { thumbnailMedia?: StoredImageMedia };
