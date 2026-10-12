import { PrismaClient } from "../generated/prisma/client";
import { IMasterDataRepository } from "../modules/master-data/domain/master-data.repository";
import { Role } from "../core/models/role";
import { TypeCourse } from "../core/models/type-course";
import { Prefix } from "../core/models/prefix";

export class MasterDataRepository implements IMasterDataRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getRoles(): Promise<Role[]> {
    const roles = await this.prisma.role.findMany();
    return roles as Role[];
  }

  async getTypeCourses(): Promise<TypeCourse[]> {
    const typeCourses = await this.prisma.typeCourse.findMany();
    return typeCourses as TypeCourse[];
  }

  async getPrefixes(): Promise<Prefix[]> {
    return this.prisma.prefix.findMany({ orderBy: { sequence: "asc" } });
  }

  async getNewsCategories() {
    return this.prisma.newsCategory.findMany({ orderBy: { id: "asc" } });
  }

  async getFields() {
    return this.prisma.field.findMany({ orderBy: { id: "asc" } });
  }

  async getCategories() {
    return this.prisma.category.findMany({ orderBy: { id: "asc" } });
  }

  async getProjectTypes() {
    return this.prisma.projectType.findMany({ orderBy: { id: "asc" } });
  }

}
