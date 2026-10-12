import { t, Static } from "elysia";
import { RoleSchema } from "../../../core/models/role";
import { TypeCourseSchema } from "../../../core/models/type-course";
import { PrefixSchema } from "../../../core/models/prefix";
import { NewsCategoryPlain } from "../../../generated/prismabox/NewsCategory";
import { FieldPlain } from "../../../generated/prismabox/Field";
import { CategoryPlain } from "../../../generated/prismabox/Category";
import { ProjectTypePlain } from "../../../generated/prismabox/ProjectType";

export const MasterData = t.Intersect([
  t.Object({
    roles: t.Array(RoleSchema),
    typeCourses: t.Array(TypeCourseSchema),
    prefixes: t.Array(PrefixSchema),
    newsCategories: t.Array(NewsCategoryPlain),
    fields: t.Array(FieldPlain),
    categories: t.Array(CategoryPlain),
    projectTypes: t.Array(ProjectTypePlain),
  }),
]);

export type MasterDataDTO = Static<typeof MasterData>;
