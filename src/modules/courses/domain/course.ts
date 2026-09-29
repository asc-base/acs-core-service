import { t, Static } from "elysia";
import { BaseModelSchema, CommonQueryParams } from "../../../core/models";
import { TypeCourseSchema } from "../../../core/models/type-course";
import {
  CurriculumDTO,
  CurriculumSchema,
} from "../../curriculums/domain/curriculum";

const CommonCourseField = {
  courseCode: t.String(),
  courseNameTh: t.String(),
  courseNameEn: t.String(),
  credits: t.String(),
  detail: t.String(),
};

export const CourseSchema = t.Recursive((Self) =>
  t.Intersect([
    t.Object({
      id: t.Number(),
      ...CommonCourseField,
      typeCourseID: t.Number(),
      curriculumID: t.Number(),
      typeCourse: TypeCourseSchema,
      curriculum: t.Intersect([CurriculumSchema, BaseModelSchema]),
      preCourses: t.Optional(
        t.Array(
          t.Object({
            prerequisite: Self,
          }),
        ),
      ),
    }),
    BaseModelSchema,
  ]),
);

export const PrerequisitesDTO = t.Object({
  id: t.Number(),
  ...CommonCourseField,
});

export const CourseDTO = t.Object({
  id: t.Number(),
  ...CommonCourseField,
  typeCourse: TypeCourseSchema,
  curriculum: CurriculumDTO,
  prerequisites: t.Array(PrerequisitesDTO),
});

export const CreateCourseDTO = t.Object({
  ...CommonCourseField,
  typeCourseID: t.Number(),
  curriculumID: t.Number(),
  preCoursesID: t.Optional(t.Array(t.Number())),
});

export const CourseQueryParams = t.Object({
  ...CommonQueryParams,
  search: t.Optional(t.String()),
  typeCourseID: t.Optional(t.Number()),
  curriculumID: t.Optional(t.Number()),
});

export const UpdateCourseDTO = t.Partial(
  t.Object({
    ...CommonCourseField,
    typeCourseID: t.Number(),
    curriculumID: t.Number(),

    newPrecourseId: t.Optional(t.Array(t.Number())),
    deletePrecourseId: t.Optional(t.Array(t.Number())),
  }),
);

export const CourseCreatePayloadSchema = t.Object({
  ...CommonCourseField,
  typeCourseID: t.Number(),
  curriculumID: t.Number(),
});

export const CourseUpdatePayloadSchema = t.Partial(
  t.Object({
    ...CommonCourseField,
    typeCourseID: t.Number(),
    curriculumID: t.Number(),
    updatedAt: t.Date(),
    deletedAt: t.Nullable(t.Date()),
  }),
);

export type CourseQueryParams = Static<typeof CourseQueryParams>;
export type Course = Static<typeof CourseSchema>;
export type CreateCourseDTO = Static<typeof CreateCourseDTO>;
export type CourseDTO = Static<typeof CourseDTO>;
export type UpdateCourseDTO = Static<typeof UpdateCourseDTO>;
export type CourseCreatePayload = Static<typeof CourseCreatePayloadSchema>;
export type CourseUpdatePayload = Static<typeof CourseUpdatePayloadSchema>;
