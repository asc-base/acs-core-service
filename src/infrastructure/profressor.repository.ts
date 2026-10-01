import { IProfessorRepository } from "../modules/professors/domain/professor.repository";
import { Prisma } from "../generated/prisma/client";
import {
  Professor,
  ProfessorQueryParams,
  ProfessorCreatePayload,
  ProfessorUpdatePayload,
} from "../modules/professors/domain/professor";
import { calculatePagination } from "../core/utils/calculator";
import { AppError } from "../core/error/app-error";
import { ErrorCode } from "../core/types/errors";
import { HttpStatusCode } from "../core/types/http";
import { PrismaInstance } from "../lib/db";

export class ProfessorRepository implements IProfessorRepository {
  constructor(private readonly db: PrismaInstance) {}

  async createProfessor(data: ProfessorCreatePayload,): Promise<Professor> {
    const professor = await this.db.professor.create({
      data,
      include: {
        user: { include: { prefix: true, imageMedia: true } },
      },
    });
    return professor as unknown as Professor;
  }

  async getProfessors(query: ProfessorQueryParams): Promise<Professor[]> {
    const {
      page = 1,
      pageSize = 10,
      orderBy = "createdAt",
      sortBy = "asc",
      search,
      searchBy,
    } = query;

    let searchCondition = {};
    if (search && searchBy && searchBy === "firstNameTh") {
      searchCondition = {
        user: { firstNameTh: { contains: search, mode: "insensitive" } },
      };
    } else if (search && searchBy) {
      searchCondition = {
        [searchBy]: { contains: search, mode: "insensitive" },
      };
    }

    const professors = await this.db.professor.findMany({
      skip: calculatePagination(page, pageSize),
      take: pageSize,
      orderBy: {
        [orderBy]: sortBy,
      },
      where: {
        deletedAt: null,
        ...searchCondition,
      },
      include: {
        user: { include: { prefix: true, imageMedia: true } },
      },
    });
    return professors as unknown as Professor[];
  }

  async getProfessorById(id: number): Promise<Professor | null> {
    try {
      const professor = await this.db.professor.findUnique({
        where: { id, deletedAt: null },
        include: {
          user: { include: { prefix: true, imageMedia: true } },
        },
      });
      return professor as Professor | null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return null;
        }
      }
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        "Database error occurred",
        HttpStatusCode.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProfessorByUserId(userID: number): Promise<Professor | null> {
    try {
      const professor = await this.db.professor.findUnique({
        where: { userID },
        include: {
          user: { include: { prefix: true, imageMedia: true } },
        },
      });
      return professor as unknown as Professor | null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return null;
        }
      }
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        "Database error occurred",
        HttpStatusCode.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateProfessor(professorID: number, data: ProfessorUpdatePayload ): Promise<Professor> {
    const professor = await this.db.professor.update({
      where: { id: professorID },
      data,
      include: {
        user: { include: { prefix: true, imageMedia: true } },
      },
    });
    return professor as unknown as Professor;
  }

  // async assignEducation(
  //   data: Prisma.EducationUncheckedCreateInput,
  // ): Promise<Education> {
  //   const education = await this.prisma.education.create({
  //     data,
  //   });
  //   return education;
  // }

  async countProfessors(query: ProfessorQueryParams): Promise<number> {
    const count = await this.db.professor.count({
      where: {
        deletedAt: null,
      },
    });
    return count;
  }

  async deleteProfessor(professorID: number): Promise<Professor | null> {
    try {
      const professor = await this.db.professor.update({
        where: { id: professorID },
        data: {
          deletedAt: new Date(),
        },
        include: {
          user: { include: { prefix: true, imageMedia: true } },
        },
      });
      return professor as unknown as Professor;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return null;
        }
      }
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        "Database error occurred",
        500,
      );
    }
  }
}
