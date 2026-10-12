import { Prisma } from "../generated/prisma/client";
import {
  Project,
  ProjectQueryParams,
  ProjectCreatePayload,
  ProjectUpdatePayload,
  ProjectMemberPayload,
  ProjectCoursePayload,
} from "../modules/projects/domain/project";
import { IProjectRepository } from "../modules/projects/domain/project.repository";
import { ErrorCode } from "../core/types/errors";
import { AppError } from "../core/error/app-error";
import { calculatePagination } from "../core/utils/calculator";
import { PrismaInstance } from "../lib/db";
import { ensureImageMedia } from "./image-media.repository";
import { writeProjectClassifications } from "./sync-project-classifications";

export class ProjectRepository implements IProjectRepository {
  constructor(
    private readonly db: PrismaInstance
  ) { }

  private projectInclude() {
    return {
      projectTags: { where: { deletedAt: null }, include: { tag: true }, orderBy: { tagID: "asc" as const } },
      projectFields: { include: { field: true }, orderBy: { fieldID: "asc" as const } },
      projectCategories: { include: { category: true }, orderBy: { categoryID: "asc" as const } },
      projectProjectTypes: { include: { type: true }, orderBy: { typeID: "asc" as const } },
      projectMembers: { include: { user: { include: { imageMedia: true } }, role: true } },
      projectCourses: { include: { course: { include: { typeCourse: true, curriculum: true } } } },
      imageMedia: true,
      images: { include: { image: true }, where: { deletedAt: null }, orderBy: { sortOrder: "asc" as const } },
    };
  }

  private async projectWhere(query: ProjectQueryParams): Promise<Prisma.ProjectWhereInput> {
    const groups: Prisma.ProjectWhereInput[] = [];
    const fieldIDs = new Set(query.fieldIds ?? []);
    const categoryIDs = new Set(query.categoryIds ?? []);
    const typeIDs = new Set(query.projectTypeIds ?? []);
    const legacyTagIDs: number[] = [];
    if (query.tagID?.length) {
      const tags = await this.db.tag.findMany({
        where: { id: { in: query.tagID } },
        include: { tageGroups: true },
      });
      const names = {
        field: new Set(tags.filter((tag) => tag.tageGroups?.name === "field").map((tag) => tag.name)),
        category: new Set(tags.filter((tag) => tag.tageGroups?.name === "category").map((tag) => tag.name)),
        type: new Set(tags.filter((tag) => tag.tageGroups?.name === "type").map((tag) => tag.name)),
      };
      const [fields, categories, types] = await Promise.all([
        this.db.field.findMany({ where: { name: { in: [...names.field] } }, select: { id: true, name: true } }),
        this.db.category.findMany({ where: { name: { in: [...names.category] } }, select: { id: true, name: true } }),
        this.db.projectType.findMany({ where: { name: { in: [...names.type] } }, select: { id: true, name: true } }),
      ]);
      fields.forEach(({ id }) => fieldIDs.add(id));
      categories.forEach(({ id }) => categoryIDs.add(id));
      types.forEach(({ id }) => typeIDs.add(id));
      const mappedNames = new Set([...fields.map(({ name }) => `field:${name}`), ...categories.map(({ name }) => `category:${name}`), ...types.map(({ name }) => `type:${name}`)]);
      legacyTagIDs.push(...tags.filter((tag) => !tag.tageGroups || !mappedNames.has(`${tag.tageGroups?.name}:${tag.name}`)).map(({ id }) => id));
      const foundIDs = new Set(tags.map(({ id }) => id));
      legacyTagIDs.push(...query.tagID.filter((id) => !foundIDs.has(id)));
    }
    if (fieldIDs.size) groups.push({ projectFields: { some: { fieldID: { in: [...fieldIDs] } } } });
    if (categoryIDs.size) groups.push({ projectCategories: { some: { categoryID: { in: [...categoryIDs] } } } });
    if (typeIDs.size) groups.push({ projectProjectTypes: { some: { typeID: { in: [...typeIDs] } } } });
    if (legacyTagIDs.length) groups.push({ projectTags: { some: { deletedAt: null, tagID: { in: [...new Set(legacyTagIDs)] } } } });

    return {
      ...(groups.length ? { OR: groups } : {}),
      ...(query.courseID?.length ? { projectCourses: { some: { courseID: { in: query.courseID } } } } : {}),
      ...(query.search && query.searchBy ? { [query.searchBy]: { contains: query.search, mode: "insensitive" as const } } : {}),
      deletedAt: null,
    };
  }

  async createProject(

    projectData: ProjectCreatePayload,
  ): Promise<Project> {
    const { thumbnailMedia, galleryMedia, tagsID, fieldIds, categoryIds, projectTypeIds, ...data } = projectData;
    return await this.db.$transaction(async (tx) => {
      const imageID = thumbnailMedia ? await ensureImageMedia(tx, thumbnailMedia) : null;
      const images = await Promise.all((galleryMedia ?? []).map(async ({ sortOrder, ...media }) => ({
        sortOrder,
        imageID: await ensureImageMedia(tx, media),
      })));
      const project = await tx.project.create({ data: { ...data, imageID, images: { create: images } } });
      await writeProjectClassifications(tx, project.id, { tagsID, fieldIds, categoryIds, projectTypeIds }, true);
      return await tx.project.findUniqueOrThrow({ where: { id: project.id }, include: this.projectInclude() }) as unknown as Project;
    });
  }

  async createProjectMember(
    data: ProjectMemberPayload[],
  ): Promise<void> {
    await this.db.projectMember.createMany({
      data,
    });
  }

  async deleteProjectMember(
    projectID: number,
    userID: number[],
  ): Promise<void> {
    await this.db.projectMember.deleteMany({
      where: {
        projectID,
        userID: {
          in: userID,
        }
      },
    });
  }

  async createProjectCourse(
    data: ProjectCoursePayload[],
  ): Promise<void> {
    await this.db.projectCourse.createMany({
      data,
    });
  }

  async deleteProjectCourse(
    projectID: number,
    courseID: number[],
  ): Promise<void> {
    await this.db.projectCourse.deleteMany({
      where: {
        projectID,
        courseID: {
          in: courseID,
        }
      },
    });
  }


  async getProject(query: ProjectQueryParams): Promise<Project[]> {
    const {
      page = query.page ?? 1,
      pageSize = query.pageSize ?? 10,
      orderBy = "createdAt",
      sortBy,
    } = query;
    const ProjectList = await this.db.project.findMany({
      skip: calculatePagination(page, pageSize),
      take: pageSize,
      orderBy: {
        [orderBy]: sortBy,
      },
      where: await this.projectWhere(query),
      include: this.projectInclude(),
    });

    return ProjectList as unknown as Project[];
  }

  async getProjectById(id: number): Promise<Project | null> {
    try {
      const project = await this.db.project.findUnique({
        where: { id, deletedAt: null },
        include: this.projectInclude(),
      });
      return project as unknown as Project | null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return null;
        }
      }
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        "An error occurred while fetching the project",
        500,
      );
    }
  }

  async countProject(query: ProjectQueryParams): Promise<number> {
    const count = await this.db.project.count({ where: await this.projectWhere(query) });
    return count;
  }

  async updateProject(
    id: number,
    projectData: ProjectUpdatePayload,
  ): Promise<Project> {
    const { thumbnailMedia, galleryMedia, fieldIds, categoryIds, projectTypeIds, newtagsID, deletedtagsID, ...data } = projectData;
    const updatedProject = await this.db.$transaction(async (tx) => {
      const imageID = thumbnailMedia ? await ensureImageMedia(tx, thumbnailMedia) : undefined;
      const images = await Promise.all((galleryMedia ?? []).map(async ({ sortOrder, ...media }) => ({
        projectID: id,
        sortOrder,
        imageID: await ensureImageMedia(tx, media),
      })));
      if (images.length) await tx.projectImage.createMany({ data: images, skipDuplicates: true });
      await tx.project.update({ where: { id, deletedAt: null }, data: { ...data, ...(imageID !== undefined && { imageID }) } });
      await writeProjectClassifications(tx, id, { fieldIds, categoryIds, projectTypeIds, newtagsID, deletedtagsID });
      return tx.project.findUniqueOrThrow({ where: { id }, include: this.projectInclude() });
    });
    return updatedProject as unknown as Project;
  }

  async deleteProject(id: number): Promise<Project> {
    const deletedProject = await this.db.project.update({
      where: { id, deletedAt: null },
      data: {
        deletedAt: new Date()
      },
    });
    return deletedProject as unknown as Project;
  }
}
