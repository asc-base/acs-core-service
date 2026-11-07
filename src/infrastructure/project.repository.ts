import { Prisma, type ProjectMemberType } from "../generated/prisma/client";
import {
  type Project,
  type ProjectCreatePayload,
  type ProjectImageWrite,
  type ProjectQueryParams,
  type ProjectUpdatePayload,
} from "../modules/projects/domain/project";
import { IProjectRepository } from "../modules/projects/domain/project.repository";
import { AppError } from "../core/error/app-error";
import { ErrorCode } from "../core/types/errors";
import { calculatePagination } from "../core/utils/calculator";
import { PrismaInstance } from "../lib/db";
import { ensureImageMedia } from "./image-media.repository";

const projectInclude = {
  projectFields: { include: { field: true }, orderBy: { fieldID: "asc" } },
  projectCategories: { include: { category: true }, orderBy: { categoryID: "asc" } },
  projectProjectTypes: { include: { type: true }, orderBy: { typeID: "asc" } },
  projectTechStacks: { include: { techStack: true }, orderBy: { techStackID: "asc" } },
  projectMembers: {
    where: { deletedAt: null },
    include: { user: { include: { imageMedia: true, prefix: true } } },
    orderBy: { id: "asc" },
  },
  projectCourses: {
    where: { deletedAt: null },
    include: { course: { include: { typeCourse: true, curriculum: true } } },
    orderBy: { id: "asc" },
  },
  imageMedia: true,
  images: {
    where: { deletedAt: null },
    include: { image: true },
    orderBy: { sortOrder: "asc" },
  },
} satisfies Prisma.ProjectInclude;

function invalid(message: string): never {
  throw new AppError(ErrorCode.VALIDATION_ERROR, message, 400);
}

function validateDistinctIDs(name: string, ids: number[]) {
  if (ids.some((id) => !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== ids.length) {
    invalid(`Invalid or duplicate project ${name} IDs`);
  }
}

async function writeProjectClassifications(
  tx: Prisma.TransactionClient,
  projectID: number,
  input: { fieldIds?: number[]; categoryIds?: number[]; projectTypeIds?: number[] },
) {
  const { fieldIds, categoryIds, projectTypeIds } = input;
  if (fieldIds !== undefined) {
    validateDistinctIDs("fields", fieldIds);
    if ((await tx.field.count({ where: { id: { in: fieldIds } } })) !== fieldIds.length) invalid("One or more project fields do not exist");
  }
  if (categoryIds !== undefined) {
    validateDistinctIDs("categories", categoryIds);
    if ((await tx.category.count({ where: { id: { in: categoryIds } } })) !== categoryIds.length) invalid("One or more project categories do not exist");
  }
  if (projectTypeIds !== undefined) {
    validateDistinctIDs("project types", projectTypeIds);
    if ((await tx.projectType.count({ where: { id: { in: projectTypeIds } } })) !== projectTypeIds.length) invalid("One or more project types do not exist");
  }

  if (fieldIds !== undefined) {
    await tx.projectField.deleteMany({ where: { projectID } });
    if (fieldIds.length) await tx.projectField.createMany({ data: fieldIds.map((fieldID) => ({ projectID, fieldID })) });
  }
  if (categoryIds !== undefined) {
    await tx.projectCategory.deleteMany({ where: { projectID } });
    if (categoryIds.length) await tx.projectCategory.createMany({ data: categoryIds.map((categoryID) => ({ projectID, categoryID })) });
  }
  if (projectTypeIds !== undefined) {
    await tx.projectProjectType.deleteMany({ where: { projectID } });
    if (projectTypeIds.length) await tx.projectProjectType.createMany({ data: projectTypeIds.map((typeID) => ({ projectID, typeID })) });
  }
}

async function writeMembers(
  tx: Prisma.TransactionClient,
  projectID: number,
  members: ProjectCreatePayload["members"],
) {
  const userIDs = members.map(({ userID }) => userID);
  validateDistinctIDs("member", userIDs);
  if (!members.some(({ memberType }) => memberType === "STUDENT")
    || !members.some(({ memberType }) => memberType === "ADVISOR")) {
    invalid("A project requires at least one student and one advisor");
  }

  const users = await tx.user.findMany({
    where: { id: { in: userIDs }, deletedAt: null },
    select: {
      id: true,
      student: { select: { deletedAt: true } },
      professor: { select: { deletedAt: true } },
    },
  });
  if (users.length !== userIDs.length) invalid("One or more project members do not exist or are inactive");

  const usersByID = new Map(users.map((user) => [user.id, user]));
  for (const member of members) {
    const user = usersByID.get(member.userID);
    const hasStudentProfile = user?.student?.deletedAt === null;
    const hasProfessorProfile = user?.professor?.deletedAt === null;
    if (member.memberType === "STUDENT" ? !hasStudentProfile : !hasProfessorProfile) {
      invalid(`Project member ${member.userID} does not have an active profile for ${member.memberType}`);
    }
  }

  await tx.projectMember.deleteMany({ where: { projectID } });
  if (members.length) {
    await tx.projectMember.createMany({
      data: members.map(({ userID, memberType, position }) => ({
        projectID,
        userID,
        memberType: memberType as ProjectMemberType,
        position: position?.trim() || null,
      })),
    });
  }
}

async function writeCourses(
  tx: Prisma.TransactionClient,
  projectID: number,
  courseIDs: number[],
) {
  validateDistinctIDs("course", courseIDs);
  const courses = await tx.course.findMany({
    where: { id: { in: courseIDs }, deletedAt: null },
    select: { id: true },
  });
  if (courses.length !== courseIDs.length) invalid("One or more project courses do not exist or are inactive");

  await tx.projectCourse.deleteMany({ where: { projectID } });
  if (courseIDs.length) {
    await tx.projectCourse.createMany({
      data: courseIDs.map((courseID) => ({ projectID, courseID })),
    });
  }
}

async function writeTechStacks(
  tx: Prisma.TransactionClient,
  projectID: number,
  names: string[],
) {
  const cleanNames = [...new Set(names.map((name) => name.trim()))];
  if (cleanNames.some((name) => name.length === 0)) invalid("Tech stack names cannot be blank");

  const stacks = await Promise.all(cleanNames.map((name) =>
    tx.techStack.upsert({ where: { name }, update: {}, create: { name }, select: { id: true } }),
  ));
  await tx.projectTechStack.deleteMany({ where: { projectID } });
  if (stacks.length) {
    await tx.projectTechStack.createMany({
      data: stacks.map(({ id: techStackID }) => ({ projectID, techStackID })),
    });
  }
}

async function writeGallery(
  tx: Prisma.TransactionClient,
  projectID: number,
  gallery: ProjectImageWrite[],
) {
  const existingIDs = gallery.flatMap((item) => "imageID" in item ? [item.imageID] : []);
  validateDistinctIDs("gallery image", existingIDs);
  if (existingIDs.length) {
    const ownedImages = await tx.projectImage.findMany({
      where: { projectID, imageID: { in: existingIDs }, deletedAt: null },
      select: { imageID: true },
    });
    if (ownedImages.length !== existingIDs.length) invalid("One or more gallery images do not belong to this project");
  }

  const orderedImages = await Promise.all(gallery.map(async (item, sortOrder) => ({
    sortOrder,
    imageID: "imageID" in item ? item.imageID : await ensureImageMedia(tx, item.media),
  })));
  await tx.projectImage.deleteMany({ where: { projectID } });
  if (orderedImages.length) {
    await tx.projectImage.createMany({
      data: orderedImages.map(({ imageID, sortOrder }) => ({ projectID, imageID, sortOrder })),
    });
  }
}

async function writeRelations(
  tx: Prisma.TransactionClient,
  projectID: number,
  input: {
    members?: ProjectCreatePayload["members"];
    courseIds?: number[];
    fieldIds?: number[];
    categoryIds?: number[];
    projectTypeIds?: number[];
    techStacks?: string[];
    galleryImages?: ProjectImageWrite[];
  },
) {
  if (input.members !== undefined) await writeMembers(tx, projectID, input.members);
  if (input.courseIds !== undefined) await writeCourses(tx, projectID, input.courseIds);
  if (input.fieldIds !== undefined || input.categoryIds !== undefined || input.projectTypeIds !== undefined) {
    await writeProjectClassifications(tx, projectID, input);
  }
  if (input.techStacks !== undefined) await writeTechStacks(tx, projectID, input.techStacks);
  if (input.galleryImages !== undefined) await writeGallery(tx, projectID, input.galleryImages);
}

export class ProjectRepository implements IProjectRepository {
  constructor(private readonly db: PrismaInstance) {}

  private async projectWhere(query: ProjectQueryParams): Promise<Prisma.ProjectWhereInput> {
    const groups: Prisma.ProjectWhereInput[] = [];
    const fieldIDs = [...new Set(query.fieldIds ?? [])];
    const categoryIDs = [...new Set(query.categoryIds ?? [])];
    const typeIDs = [...new Set(query.projectTypeIds ?? [])];
    const [fields, categories, types] = await Promise.all([
      this.db.field.findMany({ where: { id: { in: fieldIDs } }, select: { id: true } }),
      this.db.category.findMany({ where: { id: { in: categoryIDs } }, select: { id: true } }),
      this.db.projectType.findMany({ where: { id: { in: typeIDs } }, select: { id: true } }),
    ]);
    if (fields.length !== fieldIDs.length || categories.length !== categoryIDs.length || types.length !== typeIDs.length) {
      invalid("One or more project classification IDs do not exist");
    }
    if (fieldIDs.length) groups.push({ projectFields: { some: { fieldID: { in: fieldIDs } } } });
    if (categoryIDs.length) groups.push({ projectCategories: { some: { categoryID: { in: categoryIDs } } } });
    if (typeIDs.length) groups.push({ projectProjectTypes: { some: { typeID: { in: typeIDs } } } });

    return {
      ...(groups.length ? { OR: groups } : {}),
      ...(query.courseID?.length ? { projectCourses: { some: { courseID: { in: query.courseID }, deletedAt: null } } } : {}),
      ...(query.classBookID?.length ? {
        projectMembers: {
          some: {
            memberType: "STUDENT",
            deletedAt: null,
            user: { is: { student: { is: { classBookID: { in: query.classBookID }, deletedAt: null } } } },
          },
        },
      } : {}),
      ...(query.search ? { title: { contains: query.search, mode: "insensitive" } } : {}),
      deletedAt: null,
    };
  }

  async createProject(projectData: ProjectCreatePayload): Promise<Project> {
    const { thumbnailMedia, galleryImages, fieldIds, categoryIds, projectTypeIds, members, courseIds, techStacks,
      title, detail, githubURL, presentationURL, documentURL, figmaURL, youtubeURL,
      thumbnailFocalPointX, thumbnailFocalPointY } = projectData;

    return this.db.$transaction(async (tx) => {
      const imageID = await ensureImageMedia(tx, thumbnailMedia);
      const project = await tx.project.create({
        data: {
          title, detail, githubURL, presentationURL, documentURL, figmaURL, youtubeURL,
          imageID, thumbnailFocalPointX, thumbnailFocalPointY,
        },
      });
      await writeRelations(tx, project.id, {
        members, courseIds, fieldIds, categoryIds, projectTypeIds, techStacks, galleryImages,
      });
      return await tx.project.findUniqueOrThrow({ where: { id: project.id }, include: projectInclude }) as unknown as Project;
    });
  }

  async getProject(query: ProjectQueryParams): Promise<Project[]> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const rows = await this.db.project.findMany({
      skip: calculatePagination(page, pageSize),
      take: pageSize,
      orderBy: { [query.orderBy ?? "createdAt"]: query.sortBy ?? "desc" },
      where: await this.projectWhere(query),
      include: projectInclude,
    });
    return rows as unknown as Project[];
  }

  async getProjectById(id: number): Promise<Project | null> {
    return await this.db.project.findFirst({
      where: { id, deletedAt: null },
      include: projectInclude,
    }) as unknown as Project | null;
  }

  async countProject(query: ProjectQueryParams): Promise<number> {
    return this.db.project.count({ where: await this.projectWhere(query) });
  }

  async updateProject(id: number, projectData: ProjectUpdatePayload): Promise<Project> {
    const { thumbnailMedia, galleryImages, fieldIds, categoryIds, projectTypeIds,
      title, detail, githubURL, presentationURL, documentURL, figmaURL, youtubeURL,
      thumbnailFocalPointX, thumbnailFocalPointY, members, courseIds, techStacks } = projectData;
    return this.db.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id, deletedAt: null },
        data: {
          ...(title !== undefined && { title }),
          ...(detail !== undefined && { detail }),
          ...(githubURL !== undefined && { githubURL }),
          ...(presentationURL !== undefined && { presentationURL }),
          ...(documentURL !== undefined && { documentURL }),
          ...(figmaURL !== undefined && { figmaURL }),
          ...(youtubeURL !== undefined && { youtubeURL }),
          ...(thumbnailFocalPointX !== undefined && { thumbnailFocalPointX }),
          ...(thumbnailFocalPointY !== undefined && { thumbnailFocalPointY }),
          ...(thumbnailMedia && { imageID: await ensureImageMedia(tx, thumbnailMedia) }),
          updatedAt: projectData.updatedAt,
        },
      });
      await writeRelations(tx, id, {
        ...(members !== undefined && { members }),
        ...(courseIds !== undefined && { courseIds }),
        ...(fieldIds !== undefined && { fieldIds }),
        ...(categoryIds !== undefined && { categoryIds }),
        ...(projectTypeIds !== undefined && { projectTypeIds }),
        ...(techStacks !== undefined && { techStacks }),
        ...(galleryImages !== undefined && { galleryImages }),
      });
      return await tx.project.findUniqueOrThrow({ where: { id: project.id }, include: projectInclude }) as unknown as Project;
    });
  }

  async deleteProject(id: number): Promise<Project> {
    return await this.db.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return await tx.project.findUniqueOrThrow({ where: { id: project.id }, include: projectInclude }) as unknown as Project;
    });
  }
}
