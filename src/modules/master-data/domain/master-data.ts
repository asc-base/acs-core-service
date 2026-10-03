import { t, Static } from "elysia";
import { RoleSchema } from "../../../core/models/role";
import { TypeCourseSchema } from "../../../core/models/type-course";
import { Tag, TagGroup } from "../../../core/models/tag";
import { PrefixSchema } from "../../../core/models/prefix";

const NewsCategorySchema = t.Object({ id: t.Number(), code: t.String(), name: t.String() });

export const MasterData = t.Intersect([
  t.Object({
    roles: t.Array(RoleSchema),
    typeCourses: t.Array(TypeCourseSchema),
    tagsGroups: t.Array(TagGroup),
    tags: t.Array(Tag),
    prefixes: t.Array(PrefixSchema),
    newsCategories: t.Array(NewsCategorySchema),
  }),
]);

export type MasterDataDTO = Static<typeof MasterData>;
