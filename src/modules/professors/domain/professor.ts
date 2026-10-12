import { t, Static } from "elysia";
import { BaseModelSchema, CommonQueryParams } from "../../../core/models";
import {
  CommonUserFields,
  UserSchema,
  FocalPointInputFields,
} from "../../users/domain/user";
import { EducationSchema } from "./education";
import { ProfessorPlain } from "../../../generated/prismabox/Professor";
import { ProfessorPersonnelType as GeneratedProfessorPersonnelType } from "../../../generated/prismabox/ProfessorPersonnelType";

export const ProfessorPersonnelTypeSchema = GeneratedProfessorPersonnelType;

export const CommonProfessorFields = {
  ...t.Pick(ProfessorPlain, ["phone", "profRoom"]).properties,
  personnelType: t.Optional(ProfessorPlain.properties.personnelType),
};

export const ProfessorSchema = t.Object({
  ...t.Pick(ProfessorPlain, ["id", "userID", "phone", "profRoom"]).properties,
  expertFields: t.Optional(ProfessorPlain.properties.expertFields),
  educations: t.Array(EducationSchema),
  researchProfile: t.Optional(ProfessorPlain.properties.researchProfile),
  personnelType: t.Optional(ProfessorPlain.properties.personnelType),
  user: UserSchema,
  ...BaseModelSchema.properties,
});

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
  research_profile: t.Optional(t.Nullable(t.String())),
});

export const ProfessorProfileDTO = t.Object({
  id: t.Number(),
  ...CommonProfessorFields,
  expertFields: t.Array(t.String()),
  educations: t.Array(t.String()),
  research_profile: t.Nullable(t.String()),
});

export const ProfessorDTO = t.Object({
  ...UserSchema.properties,
  professor: ProfessorProfileDTO,
});

export const ProfessorQueryParams = t.Object({
  ...CommonQueryParams,
  personnelGroup: t.Optional(
    t.Union([t.Literal("academic"), t.Literal("staff")]),
  ),
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
    research_profile: t.Optional(t.Nullable(t.String())),
  }),
);

export const ProfessorCreatePayloadSchema = t.Object({
  personnelType: t.Optional(t.Nullable(ProfessorPersonnelTypeSchema)),
  ...t.Pick(ProfessorPlain, ["phone", "profRoom", "userID"]).properties,
  expertFields: t.Optional(t.Nullable(t.String())),
  educations: t.Optional(t.Array(t.String())),
  researchProfile: t.Optional(t.Nullable(t.String())),
});

export const ProfessorUpdatePayloadSchema = t.Partial(
  t.Object({
    personnelType: t.Optional(t.Nullable(ProfessorPersonnelTypeSchema)),
    phone: t.String(),
    profRoom: t.String(),
    expertFields: t.Optional(t.Nullable(t.String())),
    educations: t.Optional(t.Array(t.String())),
    researchProfile: t.Optional(t.Nullable(t.String())),
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
