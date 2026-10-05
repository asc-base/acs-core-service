import { Prisma } from "../generated/prisma/client";
import {
  Project,
  ProjectQueryParams,
  ProjectCreatePayload,
  ProjectUpdatePayload,
  ProjectTagPayload,
  ProjectMemberPayload,
  ProjectCoursePayload,
} from "../modules/projects/domain/project";
import { IProjectRepository } from "../modules/projects/domain/project.repository";
import { ErrorCode } from "../core/types/errors";
import { AppError } from "../core/error/app-error";
import { calculatePagination } from "../core/utils/calculator";
import { PrismaInstance } from "../lib/db";
import { ensureImageMedia } from "./image-media.repository";

export class ProjectRepository implements IProjectRepository {
  constructor(
    private readonly db: PrismaInstance
  ) { }

  async createProject(

    projectData: ProjectCreatePayload,
  ): Promise<Project> {
    const { thumbnailMedia, galleryMedia, ...data } = projectData;
    return await this.db.$transaction(async (tx) => {
      const imageID = thumbnailMedia ? await ensureImageMedia(tx, thumbnailMedia) : null;
      const images = await Promise.all((galleryMedia ?? []).map(async ({ sortOrder, ...media }) => ({
        sortOrder,
        imageID: await ensureImageMedia(tx, media),
      })));
      return await tx.project.create({
        data: { ...data, imageID, images: { create: images } },
        include: {
          imageMedia: true,
          images: { include: { image: true }, orderBy: { sortOrder: "asc" } },
        },
      }) as unknown as Project;
    });
  }

  async createProjectTag(
    data: ProjectTagPayload[],
  ): Promise<void> {
    await this.db.projectTag.createMany({
      data,
    });
  }

  async deleteProjectTag(
    projectID: number,
    tagID: number[],
  ): Promise<void> {
    await this.db.projectTag.deleteMany({
      where: {
        projectID,
        tagID: {
          in: tagID,
        }
      },
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
      where: {
        ...(query.tagID && {
          projectTags: {
            some: {
              tagID: {
                in: query.tagID,
              },
            },
          },
        }),

        ...(query.courseID && {
          projectCourses: {
            some: {
              courseID: {
                in: query.courseID,
              }
            },
          },
        }),

        ...(query.search &&
          query.searchBy && {
          [query.searchBy]: {
            contains: query.search,
            mode: "insensitive",
          },
        }),

        deletedAt: null,
      },

      include: {
        projectTags: {
          include: { tag: true }
        },
        projectMembers: {
          include: { user: { include: { imageMedia: true } }, role: true }
        },
        projectCourses: {
          include: {
            course: {
              include: {
                typeCourse: true,
                curriculum: true,
              }
            }
          }
        },
        imageMedia: true,
        images: { include: { image: true }, where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      }
    });

    return ProjectList as unknown as Project[];
  }

  async getProjectById(id: number): Promise<Project | null> {
    try {
      const project = await this.db.project.findUnique({
        where: { id, deletedAt: null },
        include: {
          projectTags: {
            include: { tag: true },
          },
          projectMembers: {
            include: { user: { include: { imageMedia: true } }, role: true },
          },
          projectCourses: {
            include: {
              course: {
                include: {
                  typeCourse: true,
                  curriculum: true,
                }
              }
            }
          },
          imageMedia: true,
          images: { include: { image: true }, where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
        },
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
    const count = await this.db.project.count({
      where: {
        ...(query.tagID && {
          projectTags: {
            some: {
              tagID: {
                in: query.tagID,
              },
            },
          },
          deletedAt: null,
        }),

        ...(query.courseID && {
          projectCourses: {
            some: {
              courseID: {
                in: query.courseID,
              }
            },
          },
          deletedAt: null,
        }),
        deletedAt: null,
      },
    });
    return count;
  }

  async updateProject(
    id: number,
    projectData: ProjectUpdatePayload,
  ): Promise<Project> {
    const { thumbnailMedia, galleryMedia, ...data } = projectData;
    const updatedProject = await this.db.$transaction(async (tx) => {
      const imageID = thumbnailMedia ? await ensureImageMedia(tx, thumbnailMedia) : undefined;
      const images = await Promise.all((galleryMedia ?? []).map(async ({ sortOrder, ...media }) => ({
        projectID: id,
        sortOrder,
        imageID: await ensureImageMedia(tx, media),
      })));
      if (images.length) await tx.projectImage.createMany({ data: images, skipDuplicates: true });
      return tx.project.update({
        where: { id, deletedAt: null },
        data: { ...data, ...(imageID !== undefined && { imageID }) },
        include: {
          imageMedia: true,
          images: { include: { image: true }, where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
        },
      });
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
