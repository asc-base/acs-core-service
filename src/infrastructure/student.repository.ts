import { Prisma } from "../generated/prisma/client";
import {
  Student,
  StudentQueryParams,
  StudentCreatePayload,
  StudentUpdatePayload,
} from "../modules/students/domain/student";
import { IStudentRepository } from "../modules/students/domain/student.repository";
import { calculatePagination } from "../core/utils/calculator";
import { AppError } from "../core/error/app-error";
import { ErrorCode } from "../core/types/errors";
import { PrismaInstance } from "../lib/db";

const studentViewWhere = (
  query: StudentQueryParams,
): Prisma.UserStudentViewWhereInput => ({
  ...(query.classBookID && {
    student: { is: { classBookID: query.classBookID } },
  }),
  ...(query.search && {
    OR: [
      {
        student: {
          is: {
            studentCode: { contains: query.search, mode: "insensitive" },
          },
        },
      },
      { firstNameTh: { contains: query.search, mode: "insensitive" } },
    ],
  }),
});

type StudentViewRow = Prisma.UserStudentViewGetPayload<{
  include: { student: true; prefix: true; imageMedia: true };
}>;

const toStudent = ({ student, prefix, imageMedia, ...user }: StudentViewRow) =>
  ({ ...student, user: { ...user, prefix, imageMedia } }) as Student;

export class StudentRepository implements IStudentRepository {
  constructor(private readonly db: PrismaInstance) { }

  async createStudent(data: StudentCreatePayload): Promise<Student> {
    try {
      const student = await this.db.student.create({
        data: {
          ...data,
        },
        include: {
          user: {
            include: {
              prefix: true,
              imageMedia: true,
            }
          },
        },
      });
      return student as Student;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "The class book does not exist",
          400,
        );
      }
      throw error;
    }
  }

  async getStudents(query: StudentQueryParams): Promise<Student[]> {
    const { page = 1, pageSize = 10, orderBy = "createdAt", sortBy } = query;

    const order = { [orderBy]: sortBy as Prisma.SortOrder };
    const rows = await this.db.userStudentView.findMany({
      skip: calculatePagination(page, pageSize),
      take: pageSize,
      where: studentViewWhere(query),
      orderBy: orderBy === "firstNameTh" ? order : { student: order },
      include: {
        student: true,
        prefix: true,
        imageMedia: true,
      },
    });
    return rows.map(toStudent);
  }

  async getStudentById(id: number): Promise<Student | null> {
    try {
      const row = await this.db.userStudentView.findUnique({
        where: { id },
        include: {
          student: true,
          prefix: true,
          imageMedia: true,
        },
      });
      return row ? toStudent(row) : null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return null;
        }
      }
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        "An error occurred while fetching the student",
        500,
      );
    }
  }

  async getStudentByUserId(userId: number): Promise<Student | null> {
    return this.getStudentById(userId);
  }

  async deleteStudent(id: number): Promise<Student> {
    try {
      const student = await this.db.student.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
        include: {
          user: { include: { prefix: true, imageMedia: true } },
        },
      });
      return student as Student;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new AppError(
            ErrorCode.NOT_FOUND_ERROR,
            "Student not found",
            404,
          );
        }
      }
      throw error;
    }
  }

  async updateStudent(
    studentID: number,
    data: StudentUpdatePayload,
  ): Promise<Student> {
    try {
      const student = await this.db.student.update({
        where: { id: studentID },
        data,
        include: {
          user: { include: { prefix: true, imageMedia: true } },
        },
      });
      return student as Student;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new AppError(
            ErrorCode.NOT_FOUND_ERROR,
            "Student not found",
            404,
          );
        }
      }
      throw error;
    }
  }

  async countStudents(query: StudentQueryParams): Promise<number> {
    return this.db.userStudentView.count({ where: studentViewWhere(query) });
  }
}
