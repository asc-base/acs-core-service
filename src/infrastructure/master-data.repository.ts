import { PrismaClient } from "../generated/prisma/client";
import { IMasterDataRepository } from "../modules/master-data/domain/master-data.repository";
import { Role } from "../core/models/role";
import { Tag, TagGroup } from "../core/models/tag";
import { TypeCourse } from "../core/models/type-course";
import { Prefix } from "../core/models/prefix";

export class MasterDataRepository implements IMasterDataRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getRoles(): Promise<Role[]> {
    const roles = await this.prisma.role.findMany();
    return roles as Role[];
  }

  async getTagGroup(): Promise<TagGroup[]> {
    const tagGroups = await this.prisma.tageGroups.findMany();
    return tagGroups as TagGroup[];
  }

  async getTags(): Promise<Tag[]> {
    const tags = await this.prisma.tag.findMany();
    return tags.map(({ tageGroupsId, ...rest }) => ({
      ...rest,
      tagsGroupsId: tageGroupsId,
    })) as Tag[];
  }

  async getTypeCourses(): Promise<TypeCourse[]> {
    const typeCourses = await this.prisma.typeCourse.findMany();
    return typeCourses as TypeCourse[];
  }

  async getPrefixes(): Promise<Prefix[]> {
    return this.prisma.prefix.findMany({ orderBy: { sequence: "asc" } });
  }

}
