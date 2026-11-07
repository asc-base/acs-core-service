import { t, Static } from "elysia";
import { BaseModelSchema, CommonQueryParams } from "../../../core/models";
import { PrefixSchema } from "../../../core/models/prefix";
import {
  UserSchema,
  CommonUserFields,
  UserDTO,
  FocalPointInputFields,
} from "../../users/domain/user";
import { StudentPlain } from "../../../generated/prismabox/Student";

export const CommonStudentFields = {
  ...t.Pick(StudentPlain, ["studentCode"]).properties,
  linkedin: t.Optional(StudentPlain.properties.linkedin),
  github: t.Optional(StudentPlain.properties.github),
  facebook: t.Optional(StudentPlain.properties.facebook),
  instagram: t.Optional(StudentPlain.properties.instagram),
};

export const StudentSchema = t.Object({
  ...t.Pick(StudentPlain, ["id", "userID"]).properties,
  ...CommonStudentFields,
  user: UserSchema,
  classBookID: StudentPlain.properties.classBookID,
  skills: t.Optional(StudentPlain.properties.skills),
  ...BaseModelSchema.properties,
});

export const CreateStudentModel = t.Object({
  ...CommonStudentFields,
  ...t.Pick(StudentPlain, ["classBookID"]).properties,
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
  ...t.Pick(StudentPlain, ["id"]).properties,
  prefix: t.Optional(t.Nullable(PrefixSchema)),
  ...CommonStudentFields,
  classBookID: StudentPlain.properties.classBookID,
  skills: t.Array(t.String()),
});

export const StudentDTO = t.Object({
  ...UserDTO.properties,
  student: StudentProfileDTO,
});

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
    skills: t.Optional(t.Union([t.Array(t.String()), t.Literal("")])),
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

export const StudentCreatePayloadSchema = t.Object({
  ...t.Partial(t.Pick(StudentPlain, ["id"])).properties,
  ...t.Pick(StudentPlain, ["classBookID", "userID"]).properties,
  ...CommonStudentFields,
  skills: t.Optional(StudentPlain.properties.skills),
  ...BaseModelSchema.properties,
});

export const StudentUpdatePayloadSchema = t.Object({
  ...t.Partial(t.Pick(StudentPlain, ["id", "classBookID", "userID"]))
    .properties,
  ...CommonStudentFields,
  studentCode: t.Optional(t.String()),
  skills: t.Optional(StudentPlain.properties.skills),
  ...BaseModelSchema.properties,
});

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
