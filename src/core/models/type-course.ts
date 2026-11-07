import { Static, t } from "elysia";
import { TypeCoursePlain } from "../../generated/prismabox/TypeCourse";

export const TypeCourseSchema = t.Object({
  ...t.Omit(TypeCoursePlain, ["description"]).properties,
  description: t.Optional(t.Nullable(t.String())),
});

export type TypeCourse = Static<typeof TypeCourseSchema>;
