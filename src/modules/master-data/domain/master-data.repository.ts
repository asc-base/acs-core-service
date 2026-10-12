import { Role } from "../../../core/models/role";
import { TypeCourse } from "../../../core/models/type-course";
import { Prefix } from "../../../core/models/prefix";

export interface IMasterDataRepository {
  getRoles(): Promise<Role[]>;
  getTypeCourses(): Promise<TypeCourse[]>;
  getPrefixes(): Promise<Prefix[]>;
  getNewsCategories(): Promise<Array<{ id: number; code: string; name: string }>>;
  getFields(): Promise<Array<{ id: number; name: string }>>;
  getCategories(): Promise<Array<{ id: number; name: string }>>;
  getProjectTypes(): Promise<Array<{ id: number; name: string }>>;
}
