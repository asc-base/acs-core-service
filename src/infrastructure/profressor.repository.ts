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

const professorViewWhere = (
  query: ProfessorQueryParams,
): Prisma.UserProfessorViewWhereInput => {
  if (!query.search || !query.searchBy) return {};
  const search = { contains: query.search, mode: "insensitive" as const };
  return query.searchBy === "firstNameTh"
    ? { firstNameTh: search }
    : { professor: { is: { [query.searchBy]: search } } };
};

const educationInclude = { orderBy: { sequence: "asc" as const } };

type ProfessorViewRow = Prisma.UserProfessorViewGetPayload<{
  include: { professor: { include: { educations: true } }; prefix: true; imageMedia: true };
}>;

const toProfessor = ({ professor, prefix, imageMedia, ...user }: ProfessorViewRow) =>
  ({ ...professor, user: { ...user, prefix, imageMedia } }) as Professor;

export class ProfessorRepository implements IProfessorRepository {
  constructor(private readonly db: PrismaInstance) {}

  async createProfessor(data: ProfessorCreatePayload,): Promise<Professor> {
    const { educations = [], ...professorData } = data;
    const professor = await this.db.professor.create({
      data: {
        ...professorData,
        educations: {
          create: educations.map((education, sequence) => ({ education, sequence })),
        },
      },
      include: {
        user: { include: { prefix: true, imageMedia: true } },
        educations: educationInclude,
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
    } = query;
    const order = { [orderBy]: sortBy as Prisma.SortOrder };

    const rows = await this.db.userProfessorView.findMany({
      skip: calculatePagination(page, pageSize),
      take: pageSize,
      orderBy: ["firstNameTh", "lastNameTh", "firstNameEn", "lastNameEn", "email"].includes(orderBy)
        ? order
        : { professor: order },
      where: professorViewWhere(query),
      include: {
        professor: { include: { educations: educationInclude } },
        prefix: true,
        imageMedia: true,
      },
    });
    return rows.map(toProfessor);
  }

  async getProfessorById(id: number): Promise<Professor | null> {
    try {
      const row = await this.db.userProfessorView.findUnique({
        where: { id },
        include: {
          professor: { include: { educations: educationInclude } },
          prefix: true,
          imageMedia: true,
        },
      });
      return row ? toProfessor(row) : null;
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
          educations: educationInclude,
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
    const { educations, ...professorData } = data;
    const professor = await this.db.professor.update({
      where: { id: professorID },
      data: {
        ...professorData,
        ...(educations !== undefined && {
          educations: {
            deleteMany: {},
            create: educations.map((education, sequence) => ({ education, sequence })),
          },
        }),
      },
      include: {
        user: { include: { prefix: true, imageMedia: true } },
        educations: educationInclude,
      },
    });
    return professor as unknown as Professor;
  }

  async countProfessors(query: ProfessorQueryParams): Promise<number> {
    return this.db.userProfessorView.count({ where: professorViewWhere(query) });
  }

  async deleteProfessor(userID: number): Promise<Professor | null> {
    const existing = await this.getProfessorById(userID);
    if (!existing) return null;
    try {
      const professor = await this.db.professor.update({
        where: { id: existing.id },
        data: {
          deletedAt: new Date(),
        },
        include: {
          user: { include: { prefix: true, imageMedia: true } },
          educations: educationInclude,
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
