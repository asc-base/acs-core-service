import { t, Static } from "elysia";
import { BaseModelSchema, CommonQueryParams } from "../../../core/models";

const FocalPointInputFields = {
  thumbnailFocalPointX: t.Optional(t.Numeric()),
  thumbnailFocalPointY: t.Optional(t.Numeric()),
};

const FocalPointResponseFields = {
  thumbnailFocalPointX: t.Optional(t.Nullable(t.Number())),
  thumbnailFocalPointY: t.Optional(t.Nullable(t.Number())),
};

export const CommonCurriculumField = {
  title: t.String(),
  year: t.String(),
  documentURL: t.String(),
  description: t.String(),
};

export const CurriculumSchema = t.Intersect([
  t.Object({
    id: t.Number(),
    thumbnailURL: t.String(),
    ...CommonCurriculumField,
    ...FocalPointResponseFields,
  }),
  BaseModelSchema,
]);

export const CreateCurriculumDTO = t.Object({
  thumbnailFile: t.File(),
  ...CommonCurriculumField,
  ...FocalPointInputFields,
});

export const CurriculumDTO = t.Object({
  id: t.Number(),
  thumbnailURL: t.String(),
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
  })
);

export const CurriculumCreatePayloadSchema = t.Object({
  title: t.String(),
  year: t.String(),
  documentURL: t.String(),
  description: t.String(),
  thumbnailURL: t.String(),
  ...FocalPointInputFields,
});

export const CurriculumUpdatePayloadSchema = t.Partial(
  t.Object({
    title: t.String(),
    year: t.String(),
    documentURL: t.String(),
    description: t.String(),
    thumbnailURL: t.String(),
    ...FocalPointInputFields,
  })
);

export type CurriculumCreatePayload = Static<typeof CurriculumCreatePayloadSchema>;
export type CurriculumUpdatePayload = Static<typeof CurriculumUpdatePayloadSchema>;
export type Curriculum = Static<typeof CurriculumSchema>;
export type CreateCurriculumDTO = Static<typeof CreateCurriculumDTO>;
export type CurriculumDTO = Static<typeof CurriculumDTO>;
export type CurriculumQueryParams = Static<typeof CurriculumQueryParams>;
export type CurriculumIdParam = Static<typeof CurriculumIdParam>;
export type UpdateCurriculumDTO = Static<typeof UpdateCurriculumDTO>;
