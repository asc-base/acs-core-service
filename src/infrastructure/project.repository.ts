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

type ProjectClassifications = Pick<ProjectCreatePayload, "fieldIds" | "categoryIds" | "projectTypeIds">;

async function writeProjectClassifications(
  tx: Prisma.TransactionClient,
  projectID: number,
  input: ProjectClassifications,
  create = false,
) {
  for (const [name, ids] of Object.entries({
    fields: input.fieldIds,
    categories: input.categoryIds,
    projectTypes: input.projectTypeIds,
  })) {
    if (!create && ids === undefined) continue;
    const values = ids ?? [];
    if (values.some((id) => !Number.isInteger(id) || id < 1) || new Set(values).size !== values.length) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Invalid or duplicate project ${name} IDs`, 400);
    }
  }

  const [fields, categories, types] = await Promise.all([
    tx.field.findMany({ where: { id: { in: input.fieldIds ?? [] } }, select: { id: true } }),
    tx.category.findMany({ where: { id: { in: input.categoryIds ?? [] } }, select: { id: true } }),
    tx.projectType.findMany({ where: { id: { in: input.projectTypeIds ?? [] } }, select: { id: true } }),
  ]);
  if ((input.fieldIds && fields.length !== new Set(input.fieldIds).size)
    || (input.categoryIds && categories.length !== new Set(input.categoryIds).size)
    || (input.projectTypeIds && types.length !== new Set(input.projectTypeIds).size)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "One or more project classification IDs do not exist", 400);
  }

  if (create || input.fieldIds !== undefined) {
    await tx.projectField.deleteMany({ where: { projectID } });
    if (input.fieldIds?.length) await tx.projectField.createMany({ data: input.fieldIds.map((fieldID) => ({ projectID, fieldID })) });
  }
  if (create || input.categoryIds !== undefined) {
    await tx.projectCategory.deleteMany({ where: { projectID } });
    if (input.categoryIds?.length) await tx.projectCategory.createMany({ data: input.categoryIds.map((categoryID) => ({ projectID, categoryID })) });
  }
  if (create || input.projectTypeIds !== undefined) {
    await tx.projectProjectType.deleteMany({ where: { projectID } });
    if (input.projectTypeIds?.length) await tx.projectProjectType.createMany({ data: input.projectTypeIds.map((typeID) => ({ projectID, typeID })) });
  }
}

export class ProjectRepository implements IProjectRepository {
  constructor(
    private readonly db: PrismaInstance
  ) { }

  private projectInclude() {
    return {
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
    const [fields, categories, types] = await Promise.all([
      fieldIDs.size ? this.db.field.findMany({ where: { id: { in: [...fieldIDs] } }, select: { id: true } }) : [],
      categoryIDs.size ? this.db.category.findMany({ where: { id: { in: [...categoryIDs] } }, select: { id: true } }) : [],
      typeIDs.size ? this.db.projectType.findMany({ where: { id: { in: [...typeIDs] } }, select: { id: true } }) : [],
    ]);
    if (fields.length !== fieldIDs.size || categories.length !== categoryIDs.size || types.length !== typeIDs.size) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "One or more project classification IDs do not exist", 400);
    }
    if (fieldIDs.size) groups.push({ projectFields: { some: { fieldID: { in: [...fieldIDs] } } } });
    if (categoryIDs.size) groups.push({ projectCategories: { some: { categoryID: { in: [...categoryIDs] } } } });
    if (typeIDs.size) groups.push({ projectProjectTypes: { some: { typeID: { in: [...typeIDs] } } } });

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
    const { thumbnailMedia, galleryMedia, fieldIds, categoryIds, projectTypeIds, ...data } = projectData;
    return await this.db.$transaction(async (tx) => {
      const imageID = thumbnailMedia ? await ensureImageMedia(tx, thumbnailMedia) : null;
      const images = await Promise.all((galleryMedia ?? []).map(async ({ sortOrder, ...media }) => ({
        sortOrder,
        imageID: await ensureImageMedia(tx, media),
      })));
      const project = await tx.project.create({ data: { ...data, imageID, images: { create: images } } });
      await writeProjectClassifications(tx, project.id, { fieldIds, categoryIds, projectTypeIds }, true);
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
    const { thumbnailMedia, galleryMedia, fieldIds, categoryIds, projectTypeIds, ...data } = projectData;
    const updatedProject = await this.db.$transaction(async (tx) => {
      const imageID = thumbnailMedia ? await ensureImageMedia(tx, thumbnailMedia) : undefined;
      const images = await Promise.all((galleryMedia ?? []).map(async ({ sortOrder, ...media }) => ({
        projectID: id,
        sortOrder,
        imageID: await ensureImageMedia(tx, media),
      })));
      if (images.length) await tx.projectImage.createMany({ data: images, skipDuplicates: true });
      await tx.project.update({ where: { id, deletedAt: null }, data: { ...data, ...(imageID !== undefined && { imageID }) } });
      await writeProjectClassifications(tx, id, { fieldIds, categoryIds, projectTypeIds });
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
