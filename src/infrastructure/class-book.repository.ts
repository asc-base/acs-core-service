import { IClassBookRepository } from "../modules/class-book/domain/class-book.repository";
import { Prisma } from "../generated/prisma/client";
import {
  ClassBook,
  ClassBookQueryParams,
  ClassBookCreatePayload,
  ClassBookUpdatePayload,
} from "../modules/class-book/domain/class-book";
import { calculatePagination } from "../core/utils/calculator";
import { AppError } from "../core/error/app-error";
import { ErrorCode } from "../core/types/errors";
import { PrismaInstance } from "../lib/db";
import { ensureImageMedia } from "./image-media.repository";

export class ClassBookRepository implements IClassBookRepository {
  constructor(private readonly db: PrismaInstance) {}

  async createClassBook(data: ClassBookCreatePayload): Promise<ClassBook> {
    const { thumbnailMedia, ...fields } = data;
    return await this.db.$transaction(async (tx) => {
      const imageID = thumbnailMedia ? await ensureImageMedia(tx, thumbnailMedia) : null;
      return tx.classBook.create({
        data: { ...fields, imageID },
        include: { curriculum: { include: { imageMedia: true } }, imageMedia: true },
      }) as unknown as ClassBook;
    });
  }

  async getClassBooks(query: ClassBookQueryParams): Promise<ClassBook[]> {
    const {
      page = 1,
      pageSize = 10,
      orderBy = "createdAy",
      sortBy,
      searchBy,
      search,
      curriculumID,
    } = query;
    const classBooks = await this.db.classBook.findMany({
      skip: calculatePagination(page, pageSize),
      take: pageSize,
      orderBy: {
        [orderBy]: sortBy,
      },
      where: {
        ...(curriculumID && { curriculumID }),
        ...(search &&
          searchBy && {
            [searchBy]: {
              contains: search,
              mode: "insensitive",
            },
          }),
        deletedAt: null,
      },
      include: {
        curriculum: { include: { imageMedia: true } },
        imageMedia: true,
      },
    });
    return classBooks;
  }

  async getClassBookById(id: number): Promise<ClassBook | null> {
    try {
      const classBook = await this.db.classBook.findUnique({
        where: { id, deletedAt: null },
        include: {
          curriculum: { include: { imageMedia: true } },
          imageMedia: true,
        },
      });
      return classBook;
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
  async countClassBooks(query: ClassBookQueryParams): Promise<number> {
    const { searchBy, search, curriculumID } = query;
    const count = await this.db.classBook.count({
      where: {
        ...(curriculumID && { curriculumID }),
        ...(search &&
          searchBy && {
            [searchBy]: {
              contains: search,
              mode: "insensitive",
            },
          }),
        deletedAt: null,
      },
    });
    return count;
  }

  async updateClassBook(classBookID: number, data: ClassBookUpdatePayload): Promise<ClassBook> {
    try {
      const { thumbnailMedia, ...fields } = data;
      const classBook = await this.db.$transaction(async (tx) => {
        const imageID = thumbnailMedia ? await ensureImageMedia(tx, thumbnailMedia) : undefined;
        return tx.classBook.update({
          where: { id: classBookID },
          data: { ...fields, ...(imageID !== undefined && { imageID }) },
          include: { curriculum: { include: { imageMedia: true } }, imageMedia: true },
        });
      });
      return classBook as ClassBook;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new AppError(
            ErrorCode.NOT_FOUND_ERROR,
            "ClassBook not found",
            404,
          );
        }
      }
      throw error;
    }
  }

  async deleteClassBook(id: number): Promise<ClassBook> {
    try {
      const classBook = await this.db.classBook.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
        include: {
          curriculum: { include: { imageMedia: true } },
          imageMedia: true,
        },
      });
      return classBook as ClassBook;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new AppError(
            ErrorCode.NOT_FOUND_ERROR,
            "ClassBook not found",
            404,
          );
        }
      }
      throw error;
    }
  }
}
