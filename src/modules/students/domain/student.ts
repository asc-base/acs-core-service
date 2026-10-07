import { t, Static } from "elysia";
import { BaseModelSchema, CommonQueryParams } from "../../../core/models";
import { UserSchema, CommonUserFields, UserDTO, FocalPointInputFields } from "../../users/domain/user";

export const CommonStudentFields = {
  studentCode: t.String(),
  linkedin: t.Optional(t.Nullable(t.String())),
  github: t.Optional(t.Nullable(t.String())),
  facebook: t.Optional(t.Nullable(t.String())),
  instagram: t.Optional(t.Nullable(t.String())),
};

export const StudentSchema = t.Intersect([
  t.Object({
    id: t.Number(),
    userID: t.Number(),
    ...CommonStudentFields,
    user: UserSchema,
    classBookID: t.Nullable(t.Number()),
    skills: t.Optional(t.Nullable(t.String())),
  }),
  BaseModelSchema,
]);

export const CreateStudentModel = t.Object({
  ...CommonStudentFields,
  classBookID: t.Number(),
});

export const CreateStudentDTO = t.Object({
  ...CommonStudentFields,
  ...CommonUserFields,
  ...FocalPointInputFields,
  classBookID: t.Numeric(),
  imageFile: t.Optional(t.Nullable(t.File())),
  skills: t.Optional(t.Array(t.String())),
});

export const StudentProfileDTO = t.Object({
  id: t.Number(),
  ...CommonStudentFields,
  classBookID: t.Nullable(t.Number()),
  skills: t.Array(t.String()),
});

export const StudentDTO = t.Intersect([
  UserDTO,
  t.Object({ student: StudentProfileDTO }),
]);

export const StudentQueryParams = t.Object({
  ...CommonQueryParams,
  classBookID: t.Optional(t.Number()),
  search: t.Optional(t.String()),
});

export const StudentUpdateDTO = t.Partial(
  t.Object({
    ...CommonStudentFields,
    ...CommonUserFields,
    ...FocalPointInputFields,
    classBookID: t.Numeric(),
    imageFile: t.Optional(t.Nullable(t.File())),
    skills: t.Optional(t.Array(t.String())),
  }),
);

export const CreateStudent = t.Object({
  ...CommonStudentFields,
  ...CommonUserFields,
  skills: t.Optional(t.Array(t.String())),
});

export const StudentBatchUploadDTO = t.Object({
  file: t.File(),
  classBookID: t.Numeric(),
});

export const StudentCreatePayloadSchema = t.Intersect([
  t.Object({
    id: t.Optional(t.Number()),
    classBookID: t.Number(),
    userID: t.Number(),
    ...CommonStudentFields,
    skills: t.Optional(t.Nullable(t.String())),
  }),
  BaseModelSchema,
]);

export const StudentUpdatePayloadSchema = t.Intersect([
  t.Object({
    id: t.Optional(t.Number()),
    classBookID: t.Optional(t.Number()),
    userID: t.Optional(t.Number()),
    ...CommonStudentFields,
    studentCode: t.Optional(t.String()),
    skills: t.Optional(t.Nullable(t.String())),
  }),
  BaseModelSchema,
]);

export type Student = Static<typeof StudentSchema>;
export type CreateStudentDTO = Static<typeof CreateStudentDTO>;
export type StudentDTO = Static<typeof StudentDTO>;
export type CreateStudentModel = Static<typeof CreateStudentModel>;
export type StudentQueryParams = Static<typeof StudentQueryParams>;
export type StudentUpdateDTO = Static<typeof StudentUpdateDTO>;
export type CreateStudent = Static<typeof CreateStudent>;
export type StudentBatchUploadDTO = Static<typeof StudentBatchUploadDTO>;
export type StudentCreatePayload = Static<typeof StudentCreatePayloadSchema>;
export type StudentUpdatePayload = Static<typeof StudentUpdatePayloadSchema>;
