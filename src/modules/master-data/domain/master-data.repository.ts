import { Role } from "../../../core/models/role";
import { Tag, TagGroup } from "../../../core/models/tag";
import { TypeCourse } from "../../../core/models/type-course";
import { Prefix } from "../../../core/models/prefix";

export interface IMasterDataRepository {
  getRoles(): Promise<Role[]>;
  getTags(): Promise<Tag[]>;
  getTagGroup(): Promise<TagGroup[]>;
  getTypeCourses(): Promise<TypeCourse[]>;
  getPrefixes(): Promise<Prefix[]>;
  getNewsCategories(): Promise<Array<{ id: number; code: string; name: string }>>;
}
