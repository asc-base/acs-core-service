import { t, Static } from "elysia";
import { BaseModelSchema } from "../../../core/models";
import { EducationPlain } from "../../../generated/prismabox/Education";
export const CommonEducationFields = {
  ...t.Pick(EducationPlain, ["education"]).properties,
};

export const EducationSchema = t.Object({
  ...t.Pick(EducationPlain, ["id", "professorID"]).properties,
  sequence: t.Optional(EducationPlain.properties.sequence),
  ...CommonEducationFields,
  ...BaseModelSchema.properties,
});

export const EducationDTO = t.Object({
  ...t.Pick(EducationPlain, ["id"]).properties,
  ...CommonEducationFields,
});

export type Education = Static<typeof EducationSchema>;
export type EducationDTO = Static<typeof EducationDTO>;
