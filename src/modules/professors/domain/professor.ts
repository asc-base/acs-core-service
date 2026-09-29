import { t, Static } from "elysia";
import { BaseModelSchema, CommonQueryParams } from "../../../core/models";
import {
  CommonUserFields,
  UserSchema,
  FocalPointInputFields,
} from "../../users/domain/user";
import { PrefixSchema } from "../../../core/models/prefix";

export const CommonProfessorFields = {
  phone: t.String(),
  profRoom: t.String(),
};

export const ProfessorSchema = t.Intersect([
  t.Object({
    id: t.Number(),
    userID: t.Number(),
    expertFields: t.Optional(t.Nullable(t.String())),
    educations: t.Optional(t.Nullable(t.String())),
    ...CommonProfessorFields,
    user: UserSchema,
  }),
  BaseModelSchema,
]);

export const CreateProfessorDTO = t.Object({
  ...CommonProfessorFields,
  ...CommonUserFields,
  ...FocalPointInputFields,
  imageFile: t.Optional(
    t.File({
      examples: ["professor1.jpg"],
    }),
  ),
  expertFields: t.Optional(
    t.Nullable(
      t.String({
        examples: ["Computer Science/Data Science/AI/Machine Learning"],
      }),
    ),
  ),
  educations: t.Optional(
    t.Nullable(
      t.String({
        examples: [
          "Ph.D. in Computer Science/M.Sc. in Data Science/B.Eng. in Software Engineering",
        ],
      }),
    ),
  ),
});

export const ProfessorDTO = t.Object({
  id: t.Number(),
  ...CommonProfessorFields,
  expertFields: t.Array(t.String()),
  educations: t.Array(t.String()),
  prefix: t.Optional(t.Nullable(PrefixSchema)),
  user: UserSchema,
});

export const ProfessorQueryParams = t.Object({
  ...CommonQueryParams,
  search: t.Optional(t.String()),
  searchBy: t.Optional(t.String()),
});

export const ProfessorUpdateDTO = t.Partial(
  t.Object({
    ...CommonProfessorFields,
    ...CommonUserFields,
    ...FocalPointInputFields,
    imageFile: t.Optional(t.Nullable(t.File())),
    expertFields: t.Optional(
      t.Nullable(
        t.String({
          examples: ["Computer Science, Data Science, AI,Machine Learning"],
        }),
      ),
    ),
    educations: t.Optional(
      t.Nullable(
        t.String({
          examples: [
            "Ph.D. in Computer Science / M.Sc. in Data Science / B.Eng. in Software Engineering",
          ],
        }),
      ),
    ),
  }),
);

export const ProfessorCreatePayloadSchema = t.Object({
  phone: t.String(),
  profRoom: t.String(),
  expertFields: t.Optional(t.Nullable(t.String())),
  educations: t.Optional(t.Nullable(t.String())),
  userID: t.Number(),
});

export const ProfessorUpdatePayloadSchema = t.Partial(
  t.Object({
    phone: t.String(),
    profRoom: t.String(),
    expertFields: t.Optional(t.Nullable(t.String())),
    educations: t.Optional(t.Nullable(t.String())),
    deletedAt: t.Optional(t.Nullable(t.Date())),
  }),
);

export type Professor = Static<typeof ProfessorSchema>;
export type CreateProfessorDTO = Static<typeof CreateProfessorDTO>;
export type ProfessorDTO = Static<typeof ProfessorDTO>;
export type ProfessorQueryParams = Static<typeof ProfessorQueryParams>;
export type ProfessorUpdateDTO = Static<typeof ProfessorUpdateDTO>;
export type ProfessorCreatePayload = Static<
  typeof ProfessorCreatePayloadSchema
>;
export type ProfessorUpdatePayload = Static<
  typeof ProfessorUpdatePayloadSchema
>;
