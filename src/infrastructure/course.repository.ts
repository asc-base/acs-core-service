import { ICourseRepository } from "../modules/courses/domain/course.repository";
import { Prisma } from "../generated/prisma/client";
import {
  Course,
  CourseQueryParams,
  CourseCreatePayload,
  CourseUpdatePayload,
} from "../modules/courses/domain/course";
import { calculatePagination } from "../core/utils/calculator";
import { AppError } from "../core/error/app-error";
import { ErrorCode } from "../core/types/errors";
import { PrismaInstance } from "../lib/db";

export class CourseRepository implements ICourseRepository {
  constructor(private readonly db: PrismaInstance) {}

  async createCourse(
    data: CourseCreatePayload,
    preCourseID: number[],
  ): Promise<Course> {
    try {
      const course = await this.db.course.create({
        data: {
          ...data,

          preCourses: preCourseID.length
            ? {
                create: preCourseID.map((id) => ({
                  preCourseID: id,
                })),
              }
            : undefined,
        },
        include: {
          typeCourse: true,
          curriculum: true,
          preCourses: {
            where: { deletedAt: null },
            include: {
              prerequisite: true,
            },
          },
        },
      });

      return course as unknown as Course;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async getCoures(query: CourseQueryParams): Promise<Course[]> {
    const {
      page = 1,
      pageSize = 10,
      orderBy = "createdAt",
      sortBy,
      typeCourseID,
      curriculumID,
      search,
    } = query;
    const courses = await this.db.course.findMany({
      skip: calculatePagination(page, pageSize),
      take: pageSize,
      orderBy: {
        [orderBy]: sortBy,
      },
      where: {
        deletedAt: null,
        ...(typeCourseID && { typeCourseID }),
        ...(curriculumID && { curriculumID }),
        ...(search && {
          OR: [
            {
              courseCode: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              courseNameTh: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              courseNameEn: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }),
      },
      include: {
        typeCourse: true,
        curriculum: true,
        preCourses: {
          where: {
            deletedAt: null,
          },
          include: {
            prerequisite: true,
          },
        },
      },
    });
    return courses as unknown as Course[];
  }

  async getCourseById(id: number): Promise<Course | null> {
    try {
      const course = await this.db.course.findUnique({
        where: { id },
        include: {
          typeCourse: true,
          curriculum: true,
          preCourses: {
            where: {
              deletedAt: null,
            },
            include: {
              prerequisite: true,
            },
          },
        },
      });
      return course as unknown as Course | null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return null;
        }
      }
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        "Database error occurred while fetching course by ID",
        500,
      );
    }
  }

  async countCourse(query: CourseQueryParams): Promise<number> {
    const { typeCourseID, curriculumID, search } = query;
    const count = await this.db.course.count({
      where: {
        deletedAt: null,
        ...(typeCourseID && { typeCourseID }),
        ...(curriculumID && { curriculumID }),
        ...(search && {
          OR: [
            {
              courseCode: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              courseNameTh: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              courseNameEn: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }),
      },
    });
    return count;
  }

  async updateCourse(
    courseId: number,
    data: CourseUpdatePayload,
    newPrecourseId: number[],
    deletePrecourseId: number[],
  ): Promise<Course> {
    try {
      const course = await this.db.course.update({
        where: { id: courseId },

        data: {
          ...data,

          preCourses: {
            ...(newPrecourseId.length && {
              create: newPrecourseId.map((id) => ({
                preCourseID: id,
              })),
            }),

            ...(deletePrecourseId.length && {
              deleteMany: {
                preCourseID: {
                  in: deletePrecourseId,
                },
              },
            }),
          },
        },

        include: {
          typeCourse: true,
          curriculum: true,
          preCourses: {
            where: { deletedAt: null },
            include: {
              prerequisite: true,
            },
          },
        },
      });
      return course as unknown as Course;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async deleteCourse(courseId: number): Promise<Course> {
    try {
      const course = await this.db.course.update({
        where: { id: courseId },
        data: {
          deletedAt: new Date(),
        },
        include: {
          typeCourse: true,
          curriculum: true,
        },
      });
      return course as Course;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  async createManyCourses(data: CourseCreatePayload[]): Promise<void> {
    try {
      await this.db.course.createMany({
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          throw new AppError(
            ErrorCode.DUPLICATE_DATA_ERROR,
            "A course code already exists in this curriculum",
            409,
          );
        }
        if (error.code === "P2003") {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            "A course references a type or curriculum that does not exist",
            400,
          );
        }
      }
      throw error;
    }
  }
}
