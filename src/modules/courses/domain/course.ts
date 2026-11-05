import { t, Static } from "elysia";
import { BaseModelSchema, CommonQueryParams } from "../../../core/models";
import { TypeCourseSchema } from "../../../core/models/type-course";
import {
  CurriculumDTO,
  CurriculumSchema,
} from "../../curriculums/domain/curriculum";
import { CoursePlain } from "../../../generated/prismabox/Course";
import { PreCoursePlain } from "../../../generated/prismabox/PreCourse";

const CommonCourseField = {
  ...t.Pick(CoursePlain, [
    "courseCode",
    "courseNameTh",
    "courseNameEn",
    "credits",
    "detail",
  ]).properties,
};

export const CourseSchema = t.Recursive((Self) =>
  t.Object({
    ...t.Pick(CoursePlain, ["id", "typeCourseID", "curriculumID"]).properties,
    ...CommonCourseField,
    typeCourse: TypeCourseSchema,
    curriculum: CurriculumSchema,
    preCourses: t.Optional(
      t.Array(t.Object({ ...PreCoursePlain.properties, prerequisite: Self })),
    ),
    ...BaseModelSchema.properties,
  }),
);

export const PrerequisitesDTO = t.Object({
  ...t.Pick(CoursePlain, ["id"]).properties,
  ...CommonCourseField,
});

export const CourseDTO = t.Object({
  ...t.Pick(CoursePlain, ["id"]).properties,
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
  ...t.Pick(CoursePlain, ["typeCourseID", "curriculumID"]).properties,
});

export const CourseUpdatePayloadSchema = t.Partial(
  t.Object({
    ...CommonCourseField,
    ...t.Pick(CoursePlain, ["typeCourseID", "curriculumID"]).properties,
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
