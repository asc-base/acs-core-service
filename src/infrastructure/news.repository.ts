import { Prisma } from "../generated/prisma/client";
import { INewsRepository } from "../modules/news/domain/news.repository";
import {
  News,
  NewsQueryParams,
  NewsCreatePayload,
  NewsUpdatePayload,
  NewsWithAdditionalImages,
  NewsBulletinType,
  NewsBulletinView,
} from "../modules/news/domain/news";
import { AppError } from "../core/error/app-error";
import { ErrorCode } from "../core/types/errors";
import { calculatePagination } from "../core/utils/calculator";
import { PrismaInstance } from "../lib/db";

const newsImages = { where: { deletedAt: null }, include: { image: true }, orderBy: { sortOrder: "asc" as const } };

export class NewsRepository implements INewsRepository {
  constructor(private readonly db: PrismaInstance) { }

  private async newsWhere(query: NewsQueryParams): Promise<Prisma.NewsWhereInput> {
    if (query.newsCategoryId === undefined) return { deletedAt: null };
    const category = await this.db.newsCategory.findUnique({ where: { id: query.newsCategoryId }, select: { id: true } });
    if (!category) throw new AppError(ErrorCode.VALIDATION_ERROR, "News category does not exist", 400);
    return { newsCategoryID: category.id, deletedAt: null };
  }

  async getNewsBulletins(type: NewsBulletinType): Promise<NewsBulletinView[]> {
    const rows = await this.db.newsBulletin.findMany({
      where: { type, deletedAt: null, news: { deletedAt: null } },
      include: { news: { include: { newsCategory: true, newsImages } } },
      orderBy: { id: "asc" },
    });
    return rows.map(({ news, ...bulletin }) => ({
      ...bulletin,
      news: {
        ...news,
        category: news.newsCategory,
        images: news.newsImages.map(({ image, ...row }) => ({ ...row, imageUrl: image.imageUrl })),
      },
    }));
  }

  async setNewsBulletin(newsID: number, type: NewsBulletinType, enabled: boolean): Promise<NewsBulletinView | null> {
    return this.db.$transaction(async (tx) => {
      const news = await tx.news.findFirst({ where: { id: newsID, deletedAt: null }, select: { id: true } });
      if (!news) throw new AppError(ErrorCode.NOT_FOUND_ERROR, "News not found", 404);
      if (enabled) {
        const imageType = type === "HIGHLIGHT" ? "THUMBNAIL" as const : "CARD" as const;
        const image = await tx.newsImage.findFirst({ where: { newsID, imageType, deletedAt: null } });
        if (!image) throw new AppError(ErrorCode.VALIDATION_ERROR, `${imageType} image is required for this bulletin`, 400);
        await tx.newsBulletin.upsert({
          where: { newsID_type: { newsID, type } },
          create: { newsID, type },
          update: { deletedAt: null },
        });
      } else {
        const result = await tx.newsBulletin.updateMany({ where: { newsID, type, deletedAt: null }, data: { deletedAt: new Date() } });
        if (!result.count) return null;
      }
      const bulletin = await tx.newsBulletin.findUniqueOrThrow({
        where: { newsID_type: { newsID, type } },
        include: { news: { include: { newsCategory: true, newsImages } } },
      });
      return {
        ...bulletin,
        news: {
          ...bulletin.news,
          category: bulletin.news.newsCategory,
          images: bulletin.news.newsImages.map(({ image, ...row }) => ({ ...row, imageUrl: image.imageUrl })),
        },
      };
    });
  }

  async createNews(data: NewsCreatePayload): Promise<NewsWithAdditionalImages> {
    const { images = [], additionalImageUrls = [], newsCategoryID, ...fields } = data;
    return this.db.$transaction(async (tx) => {
      const category = await tx.newsCategory.findUnique({ where: { id: newsCategoryID } });
      if (!category) throw new AppError(ErrorCode.VALIDATION_ERROR, "News category does not exist", 400);
      const news = await tx.news.create({
        data: {
          ...fields,
          newsCategory: { connect: { id: newsCategoryID } },
          ...(images.length ? {
            newsImages: {
              create: images.map(({ media, ...image }) => ({
                ...image,
                image: { connectOrCreate: { where: { imageUrl: media.imageUrl }, create: media } },
              })),
            },
          } : {}),
          ...(additionalImageUrls.length ? {
            newsAdditionalImages: { create: additionalImageUrls.map((imageUrl) => ({ imageUrl })) },
          } : {}),
        },
        include: { newsCategory: true, newsImages, newsAdditionalImages: { where: { deletedAt: null } } },
      });
      return {
        ...news,
        category: news.newsCategory,
        images: news.newsImages.map(({ image, ...row }) => ({ ...row, imageUrl: image.imageUrl })),
      };
    });
  }

  async getNews(query: NewsQueryParams): Promise<News[]> {
    const { page = 1, pageSize = 10, orderBy = "createdAt", sortBy, search, searchBy } = query;
    const newsWhere = await this.newsWhere(query);
    const newsList = await this.db.news.findMany({
      skip: calculatePagination(page, pageSize),
      take: pageSize,
      orderBy: { [orderBy]: sortBy },
      where: {
        ...newsWhere,
        ...(search && searchBy ? { [searchBy]: { contains: search, mode: "insensitive" as const } } : {}),
      },
      include: { newsCategory: true, newsImages },
    });
    return newsList.map((news) => ({
      ...news,
      category: news.newsCategory,
      images: news.newsImages.map(({ image, ...row }) => ({ ...row, imageUrl: image.imageUrl })),
    }));
  }

  async getNewsById(id: number): Promise<NewsWithAdditionalImages | null> {
    try {
      const news = await this.db.news.findUnique({
        where: { id, deletedAt: null },
        include: {
          newsCategory: true,
          newsImages,
          newsAdditionalImages: { where: { newsID: id, deletedAt: null } },
        },
      });
      if (!news) return null;
      return {
        ...news,
        category: news.newsCategory,
        images: news.newsImages.map(({ image, ...row }) => ({ ...row, imageUrl: image.imageUrl })),
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new AppError(ErrorCode.NOT_FOUND_ERROR, "News not found", 404);
      }
      throw new AppError(ErrorCode.DATABASE_ERROR, "Database error occurred", 500);
    }
  }

  async countNews(query: NewsQueryParams): Promise<number> {
    const newsWhere = await this.newsWhere(query);
    return this.db.news.count({
      where: {
        ...newsWhere,
        ...(query.search && query.searchBy ? { [query.searchBy]: { contains: query.search, mode: "insensitive" as const } } : {}),
      },
    });
  }

  async deleteNews(id: number): Promise<News | null> {
    try {
      return await this.db.$transaction(async (tx) => {
        const now = new Date();
        const row = await tx.news.update({ where: { id, deletedAt: null }, data: { deletedAt: now }, include: { newsCategory: true } });
        await Promise.all([
          tx.newsImage.updateMany({ where: { newsID: id, deletedAt: null }, data: { deletedAt: now } }),
          tx.newsBulletin.updateMany({ where: { newsID: id, deletedAt: null }, data: { deletedAt: now } }),
          tx.newsAdditionalImage.updateMany({ where: { newsID: id, deletedAt: null }, data: { deletedAt: now } }),
        ]);
        return { ...row, category: row.newsCategory };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
      throw new AppError(ErrorCode.DATABASE_ERROR, "Database error occurred", 500);
    }
  }

  async updateNews(newsID: number, data: NewsUpdatePayload): Promise<NewsWithAdditionalImages> {
    const {
      newsCategoryID, images = [], additionalImageUrls = [], deletedImageIds = [],
      deletedAdditionalImagesId = [], detailImageOrder, cardFocalPointX, cardFocalPointY,
      thumbnailImageFocalPointX, thumbnailImageFocalPointY, ...newsData
    } = data;
    return this.db.$transaction(async (tx) => {
      const now = new Date();
      const imageRows: Array<{ id: number; imageType: string }> = [];
      if (newsCategoryID !== undefined && !(await tx.newsCategory.findUnique({ where: { id: newsCategoryID }, select: { id: true } }))) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, "News category does not exist", 400);
      }
      const news = await tx.news.update({
        where: { id: newsID, deletedAt: null },
        data: {
          ...newsData,
          ...(newsCategoryID !== undefined ? { newsCategory: { connect: { id: newsCategoryID } } } : {}),
        },
      });
      if (cardFocalPointX !== undefined || cardFocalPointY !== undefined) {
        await tx.newsImage.updateMany({
          where: { newsID, imageType: "CARD", deletedAt: null },
          data: { ...(cardFocalPointX !== undefined ? { focalPointX: cardFocalPointX } : {}), ...(cardFocalPointY !== undefined ? { focalPointY: cardFocalPointY } : {}) },
        });
      }
      if (thumbnailImageFocalPointX !== undefined || thumbnailImageFocalPointY !== undefined) {
        await tx.newsImage.updateMany({
          where: { newsID, imageType: "THUMBNAIL", deletedAt: null },
          data: { ...(thumbnailImageFocalPointX !== undefined ? { focalPointX: thumbnailImageFocalPointX } : {}), ...(thumbnailImageFocalPointY !== undefined ? { focalPointY: thumbnailImageFocalPointY } : {}) },
        });
      }

      for (const image of images) {
        const media = await tx.imageMedia.upsert({ where: { imageUrl: image.media.imageUrl }, create: image.media, update: {} });
        if (image.imageType !== "DETAIL") {
          await tx.newsImage.updateMany({
            where: { newsID, imageType: image.imageType, imageID: { not: media.id }, deletedAt: null },
            data: { deletedAt: now },
          });
        }
        const key = { newsID_imageID_imageType: { newsID, imageID: media.id, imageType: image.imageType } };
        const existing = await tx.newsImage.findUnique({ where: key });
        const row = existing
          ? await tx.newsImage.update({ where: { id: existing.id }, data: { deletedAt: null, focalPointX: image.focalPointX, focalPointY: image.focalPointY, sortOrder: image.sortOrder ?? 0, updatedAt: now } })
          : await tx.newsImage.create({ data: { newsID, imageID: media.id, imageType: image.imageType, focalPointX: image.focalPointX, focalPointY: image.focalPointY, sortOrder: image.sortOrder ?? 0 } });
        imageRows.push({ id: row.id, imageType: row.imageType });
        if (image.imageType === "DETAIL") await tx.newsAdditionalImage.create({ data: { newsID, imageUrl: media.imageUrl } });
      }

      if (deletedImageIds.length) {
        const removed = await tx.newsImage.findMany({ where: { id: { in: deletedImageIds }, newsID, imageType: "DETAIL", deletedAt: null }, include: { image: true } });
        if (removed.length !== new Set(deletedImageIds).size) throw new AppError(ErrorCode.VALIDATION_ERROR, "One or more detail images do not belong to this news", 400);
        await tx.newsImage.updateMany({ where: { id: { in: deletedImageIds }, newsID }, data: { deletedAt: now } });
        for (const row of removed) await tx.newsAdditionalImage.updateMany({ where: { newsID, imageUrl: row.image.imageUrl, deletedAt: null }, data: { deletedAt: now } });
      }

      if (deletedAdditionalImagesId.length) {
        const removed = await tx.newsAdditionalImage.findMany({ where: { id: { in: deletedAdditionalImagesId }, newsID, deletedAt: null } });
        if (removed.length !== new Set(deletedAdditionalImagesId).size) throw new AppError(ErrorCode.VALIDATION_ERROR, "One or more detail images do not belong to this news", 400);
        await tx.newsAdditionalImage.updateMany({ where: { id: { in: deletedAdditionalImagesId }, newsID }, data: { deletedAt: now } });
        const media = await tx.imageMedia.findMany({ where: { imageUrl: { in: removed.map((image) => image.imageUrl) } }, select: { id: true } });
        await tx.newsImage.updateMany({ where: { newsID, imageType: "DETAIL", imageID: { in: media.map(({ id }) => id) }, deletedAt: null }, data: { deletedAt: now } });
      }

      if (detailImageOrder) {
        const active = await tx.newsImage.findMany({ where: { newsID, imageType: "DETAIL", deletedAt: null } });
        const newIDs = imageRows.filter((row) => row.imageType === "DETAIL").map(({ id }) => id);
        const orderedIDs = detailImageOrder.map((value) => value.startsWith("new:") ? newIDs[Number(value.slice(4))] : Number(value));
        if (orderedIDs.length !== active.length || new Set(orderedIDs).size !== active.length || active.some((row) => !orderedIDs.includes(row.id))) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, "Detail image order must include every active image exactly once", 400);
        }
        await Promise.all(orderedIDs.map((id, sortOrder) => tx.newsImage.update({ where: { id }, data: { sortOrder } })));
      } else if (additionalImageUrls.length) {
        const current = await tx.newsImage.count({ where: { newsID, imageType: "DETAIL", deletedAt: null } });
        const firstOrder = Math.max(0, current - imageRows.filter((row) => row.imageType === "DETAIL").length);
        for (const [index, row] of imageRows.filter((value) => value.imageType === "DETAIL").entries()) {
          await tx.newsImage.update({ where: { id: row.id }, data: { sortOrder: firstOrder + index } });
        }
      }

      const result = await tx.news.findUniqueOrThrow({
        where: { id: news.id },
        include: { newsCategory: true, newsImages, newsAdditionalImages: { where: { deletedAt: null }, orderBy: { id: "asc" } } },
      });
      return {
        ...result,
        category: result.newsCategory,
        images: result.newsImages.map(({ image, ...row }) => ({ ...row, imageUrl: image.imageUrl })),
      };
    });
  }
}
