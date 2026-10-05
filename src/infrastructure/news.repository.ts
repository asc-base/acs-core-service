import { Prisma } from "../generated/prisma/client";
import { INewsRepository } from "../modules/news/domain/news.repository";
import {
  News,
  NewsFeature,
  NewsQueryParams,
  QueryNewsFeatureParams,
  NewsCreatePayload,
  NewsUpdatePayload,
  NewsFeatureUpsertPayload,
  NewsWithAdditionalImages,
  NewsBulletinType,
  NewsBulletinView,
} from "../modules/news/domain/news";
import { AppError } from "../core/error/app-error";
import { ErrorCode } from "../core/types/errors";
import { calculatePagination } from "../core/utils/calculator";
import { PrismaInstance } from "../lib/db";
export class NewsRepository implements INewsRepository {
  constructor(private readonly db: PrismaInstance) { }

  async getNewsBulletins(type: NewsBulletinType): Promise<NewsBulletinView[]> {
    const rows = await this.db.newsBulletin.findMany({
      where: { type, deletedAt: null, news: { deletedAt: null } },
      include: { news: { include: {
        tag: true, newsCategory: true,
        newsImages: { where: { deletedAt: null }, include: { image: true }, orderBy: { sortOrder: "asc" } },
      } } },
      orderBy: { id: "asc" },
    });
    return rows.map(({ news, ...bulletin }) => ({
      ...bulletin,
      news: {
        ...news,
        category: news.newsCategory,
        images: news.newsImages.map(({ image, ...row }) => ({ ...row, imageUrl: image.imageUrl })),
        tag: news.tag ? { ...news.tag, tagsGroupsId: news.tag.tageGroupsId } : undefined,
      },
    }));
  }

  async setNewsBulletin(newsID: number, type: NewsBulletinType, enabled: boolean): Promise<NewsBulletinView | null> {
    return this.db.$transaction(async (tx) => {
      const news = await tx.news.findFirst({ where: { id: newsID, deletedAt: null }, select: { id: true } });
      if (!news) throw new AppError(ErrorCode.NOT_FOUND_ERROR, "News not found", 404);
      const tagName = type === "HIGHLIGHT" ? "newshighlight" : "announcement";
      const tag = await tx.tag.findFirst({ where: { name: tagName, tageGroups: { name: "news-feature" } } });
      if (enabled) {
        const imageType = type === "HIGHLIGHT" ? "THUMBNAIL" as const : "CARD" as const;
        const image = await tx.newsImage.findFirst({ where: { newsID, imageType, deletedAt: null }, include: { image: true } });
        if (!image) throw new AppError(ErrorCode.VALIDATION_ERROR, `${imageType} image is required for this bulletin`, 400);
        const bulletin = await tx.newsBulletin.upsert({
          where: { newsID_type: { newsID, type } },
          create: { newsID, type },
          update: { deletedAt: null },
        });
        if (tag) await tx.newsFeatures.upsert({
          where: { newsID_tagID: { newsID, tagID: tag.id } },
          create: { newsID, tagID: tag.id, thumbnailURL: image.image.imageUrl, thumbnailFocalPointX: image.focalPointX, thumbnailFocalPointY: image.focalPointY },
          update: { thumbnailURL: image.image.imageUrl, thumbnailFocalPointX: image.focalPointX, thumbnailFocalPointY: image.focalPointY, deletedAt: null },
        });
        const row = await tx.newsBulletin.findUniqueOrThrow({
          where: { id: bulletin.id },
          include: {
            news: {
              include: {
                tag: true,
                newsCategory: true,
                newsImages: {
                  where: { deletedAt: null },
                  include: { image: true },
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        });
        return { ...row, news: { ...row.news, category: row.news.newsCategory, images: row.news.newsImages.map(({ image, ...link }) => ({ ...link, imageUrl: image.imageUrl })), tag: row.news.tag ? { ...row.news.tag, tagsGroupsId: row.news.tag.tageGroupsId } : undefined } };
      }

      const result = await tx.newsBulletin.updateMany({ where: { newsID, type, deletedAt: null }, data: { deletedAt: new Date() } });
      if (tag) await tx.newsFeatures.updateMany({ where: { newsID, tagID: tag.id, deletedAt: null }, data: { deletedAt: new Date() } });
      if (!result.count) return null;
      const row = await tx.newsBulletin.findUniqueOrThrow({
        where: { newsID_type: { newsID, type } },
        include: {
          news: {
            include: {
              tag: true,
              newsCategory: true,
              newsImages: {
                where: { deletedAt: null },
                include: { image: true },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
        },
      });
      return { ...row, news: { ...row.news, category: row.news.newsCategory, images: row.news.newsImages.map(({ image, ...link }) => ({ ...link, imageUrl: image.imageUrl })), tag: row.news.tag ? { ...row.news.tag, tagsGroupsId: row.news.tag.tageGroupsId } : undefined } };
    });
  }

  private async syncFeatureMedia(tx: Prisma.TransactionClient, data: NewsFeatureUpsertPayload) {
    const tag = await tx.tag.findUnique({ where: { id: data.tagID }, include: { tageGroups: true } });
    if (tag?.tageGroups?.name !== "news-feature") return;
    const type = tag.name.toLowerCase() === "announcement"
      ? "ANNOUNCEMENT" as const
      : tag.name.toLowerCase() === "newshighlight"
        ? "HIGHLIGHT" as const
        : null;
    if (!type) return;
    const imageType = type === "ANNOUNCEMENT" ? "CARD" as const : "THUMBNAIL" as const;
    const mediaData = data.media ?? { provider: "legacy_url", imageUrl: data.thumbnailURL };
    const media = await tx.imageMedia.upsert({
      where: { imageUrl: data.thumbnailURL },
      create: mediaData,
      update: {},
    });
    const active = await tx.newsImage.findFirst({ where: { newsID: data.newsID, imageType, deletedAt: null } });
    if (active && active.imageID !== media.id) {
      await tx.newsImage.update({ where: { id: active.id }, data: { deletedAt: new Date() } });
    }
    const key = { newsID_imageID_imageType: { newsID: data.newsID, imageID: media.id, imageType } };
    const existing = await tx.newsImage.findUnique({ where: key });
    if (existing) {
      await tx.newsImage.update({ where: { id: existing.id }, data: {
        deletedAt: null,
        focalPointX: data.thumbnailFocalPointX,
        focalPointY: data.thumbnailFocalPointY,
      } });
    } else {
      await tx.newsImage.create({ data: {
        newsID: data.newsID, imageID: media.id, imageType,
        focalPointX: data.thumbnailFocalPointX, focalPointY: data.thumbnailFocalPointY,
      } });
    }
    await tx.newsBulletin.upsert({
      where: { newsID_type: { newsID: data.newsID, type } },
      create: { newsID: data.newsID, type },
      update: { deletedAt: null },
    });
  }

  async createNews(data: NewsCreatePayload): Promise<NewsWithAdditionalImages> {
    const { images = [], additionalImageUrls = [], newsCategoryID, tagID, ...fields } = data;
    return this.db.$transaction(async (tx) => {
    const categoryID = newsCategoryID ?? (await tx.newsCategory.findUnique({ where: { id: tagID }, select: { id: true } }))?.id;
    const news = await tx.news.create({
      data: {
        ...fields,
        tag: { connect: { id: tagID } },
        ...(categoryID ? { newsCategory: { connect: { id: categoryID } } } : {}),
        ...(images.length ? {
          newsImages: {
            create: images.map(({ media, ...image }) => ({
              ...image,
              image: {
                connectOrCreate: {
                  where: { imageUrl: media.imageUrl },
                  create: media,
                },
              },
            })),
          },
        } : {}),
        ...(additionalImageUrls.length ? {
          newsAdditionalImages: {
            create: additionalImageUrls.map((imageUrl) => ({ imageUrl })),
          },
        } : {}),
      },
      include: {
        tag: true,
        newsCategory: true,
        newsImages: { where: { deletedAt: null }, include: { image: true }, orderBy: { sortOrder: "asc" } },
        newsAdditionalImages: { where: { deletedAt: null } },
      },
    });
    return {
      ...news,
      category: news.newsCategory,
      images: news.newsImages.map(({ image, ...row }) => ({ ...row, imageUrl: image.imageUrl })),
      tag: news.tag
        ? {
          ...news.tag,
          tagsGroupsId: news.tag.tageGroupsId,
          // Remove the incorrect property if present
          // Optionally: ...news.tag without 'tageGroupsId'
        }
        : undefined,
    };
    });
  }

  async getNews(query: NewsQueryParams): Promise<News[]> {
    const {
      page = 1,
      pageSize = 10,
      orderBy = "createdAt",
      sortBy,
      search,
      searchBy,
    } = query;
    const newsList = await this.db.news.findMany({
      skip: calculatePagination(page, pageSize),
      take: pageSize,
      orderBy: {
        [orderBy]: sortBy,
      },
      where: {
        ...(query.tagID && { tagID: query.tagID }),
        ...(search &&
          searchBy && {
          [searchBy]: { contains: search, mode: "insensitive" },
        }),
        deletedAt: null,
      },
      include: {
        tag: true,
        newsCategory: true,
        newsImages: { where: { deletedAt: null }, include: { image: true }, orderBy: { sortOrder: "asc" } },
      },
    });
    return newsList.map((news) => ({
      ...news,
      category: news.newsCategory,
      images: news.newsImages.map(({ image, ...row }) => ({ ...row, imageUrl: image.imageUrl })),
      tag: news.tag
        ? {
          ...news.tag,
          tagsGroupsId: news.tag.tageGroupsId,
        }
        : undefined,
    }));
  }

  async getNewsById(id: number): Promise<NewsWithAdditionalImages | null> {
    try {
      const news = await this.db.news.findUnique({
        where: { id, deletedAt: null },
        include: {
          tag: true,
          newsCategory: true,
          newsImages: { where: { deletedAt: null }, include: { image: true }, orderBy: { sortOrder: "asc" } },
          newsAdditionalImages: {
            where: { newsID: id , deletedAt: null },
          },
        }
      });
      if (!news) return null;
      return {
        ...news,
        category: news.newsCategory,
        images: news.newsImages.map(({ image, ...row }) => ({ ...row, imageUrl: image.imageUrl })),
        tag: news.tag
          ? {
            ...news.tag,
            tagsGroupsId: news.tag.tageGroupsId,
          }
          : undefined,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          throw new AppError(ErrorCode.NOT_FOUND_ERROR, "News not found", 404);
        }
      }
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        "Database error occurred",
        500,
      );
    }
  }

  async createNewsFeature(
    newsFeatureData: NewsFeatureUpsertPayload,
  ): Promise<NewsFeature> {
    const data: Prisma.NewsFeaturesUncheckedCreateInput = {
      newsID: newsFeatureData.newsID,
      tagID: newsFeatureData.tagID,
      thumbnailURL: newsFeatureData.thumbnailURL,
      thumbnailFocalPointX : newsFeatureData.thumbnailFocalPointX,
      thumbnailFocalPointY : newsFeatureData.thumbnailFocalPointY,
    };

    const newsFeature = await this.db.$transaction(async (tx) => {
      const created = await tx.newsFeatures.create({
        data,
        include: { news: { include: { tag: true } } },
      });
      await this.syncFeatureMedia(tx, newsFeatureData);
      return created;
    });

    return {
      ...newsFeature,
      news: {
        ...newsFeature.news,
        tag: newsFeature.news.tag
          ? {
            ...newsFeature.news.tag,
            tagsGroupsId: newsFeature.news.tag.tageGroupsId,
          }
          : undefined,
      },
    };
  }

  async updateNewsFeature(
    id: number,
    newsFeatureData: NewsFeatureUpsertPayload,
  ): Promise<NewsFeature> {
    const data: Prisma.NewsFeaturesUncheckedUpdateInput = {
      newsID: newsFeatureData.newsID,
      tagID: newsFeatureData.tagID,
      thumbnailURL: newsFeatureData.thumbnailURL,
      thumbnailFocalPointX : newsFeatureData.thumbnailFocalPointX,
      thumbnailFocalPointY : newsFeatureData.thumbnailFocalPointY,
    };

    const newsFeature = await this.db.$transaction(async (tx) => {
      const updated = await tx.newsFeatures.update({
        where: { id },
        data,
        include: { news: { include: { tag: true } } },
      });
      await this.syncFeatureMedia(tx, newsFeatureData);
      return updated;
    });

    return {
      ...newsFeature,
      news: {
        ...newsFeature.news,
        tag: newsFeature.news.tag
          ? {
            ...newsFeature.news.tag,
            tagsGroupsId: newsFeature.news.tag.tageGroupsId,
          }
          : undefined,
      },
    };
  }

  async getNewsFeaturesBy(
    query: QueryNewsFeatureParams,
  ): Promise<NewsFeature[]> {
    const newsFeatures = await this.db.newsFeatures.findMany({
      where: {
        ...(query.tagID && { tagID: query.tagID }),
        news: { deletedAt: null },
        deletedAt: null,
      },
      include: {
        news: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: {
        id: "asc",
      },
    });
    return newsFeatures.map((newsFeature) => ({
      ...newsFeature,
      news: {
        ...newsFeature.news,
        tag: newsFeature.news.tag
          ? {
            ...newsFeature.news.tag,
            tagsGroupsId: newsFeature.news.tag.tageGroupsId,
          }
          : undefined,
      },
    }));
  }

  async getNewsFeatureById(id: number): Promise<NewsFeature | null> {
    try {
      const newsFeature = await this.db.newsFeatures.findUnique({
      where: { id, deletedAt: null, news: { deletedAt: null } },
        include: {
          news: {
            include: {
              tag: true,
            },
          },
        },
      });
      if (!newsFeature) {
        return null;
      }
      return {
        ...newsFeature,
        news: {
          ...newsFeature.news,
          tag: newsFeature.news.tag
            ? {
              ...newsFeature.news.tag,
              tagsGroupsId: newsFeature.news.tag.tageGroupsId,
            }
            : undefined,
        },
      };
    } catch (error) {
      console.error("🔥 Error in getNewsFeatureById:", error);
      return null;
    }
  }

  async countNews(query: NewsQueryParams): Promise<number> {
    const count = await this.db.news.count({
      where: {
        ...(query.tagID && { tagID: query.tagID }),
        ...(query.search && query.searchBy && { [query.searchBy]: { contains: query.search, mode: "insensitive" } }),
        deletedAt: null,
      },
    });
    return count;
  }

  async countNewsFeatures(query: QueryNewsFeatureParams): Promise<number> {
    const count = await this.db.newsFeatures.count({
      where: {
        ...(query.tagID && { tagID: query.tagID }),
        news: { deletedAt: null },
        deletedAt: null,
      },
    });
    return count;
  }

  async deleteNews(id: number): Promise<News | null> {
    try {
      const news = await this.db.$transaction(async (tx) => {
        const row = await tx.news.update({ where: { id, deletedAt: null }, data: { deletedAt: new Date() }, include: { tag: true } });
        const now = new Date();
        await Promise.all([
          tx.newsImage.updateMany({ where: { newsID: id, deletedAt: null }, data: { deletedAt: now } }),
          tx.newsBulletin.updateMany({ where: { newsID: id, deletedAt: null }, data: { deletedAt: now } }),
          tx.newsFeatures.updateMany({ where: { newsID: id, deletedAt: null }, data: { deletedAt: now } }),
          tx.newsAdditionalImage.updateMany({ where: { newsID: id, deletedAt: null }, data: { deletedAt: now } }),
        ]);
        return row;
      });
      return {
        ...news,
        tag: news.tag
          ? {
            ...news.tag,
            tagsGroupsId: news.tag.tageGroupsId,
          }
          : undefined,
      };
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

  async updateNews(
    newsID: number,
    data: NewsUpdatePayload
  ): Promise<NewsWithAdditionalImages> {
    const {
      tagID, newsCategoryID, images = [], additionalImageUrls = [],
      deletedImageIds = [], deletedAdditionalImagesId = [], detailImageOrder,
      cardFocalPointX, cardFocalPointY, thumbnailImageFocalPointX, thumbnailImageFocalPointY,
      ...newsData
    } = data;
    return this.db.$transaction(async (tx) => {
      const now = new Date();
      const imageRows: Array<{ id: number; imageType: string; imageUrl: string }> = [];
      const categoryID = newsCategoryID !== undefined
        ? newsCategoryID
        : tagID !== undefined
          ? (await tx.newsCategory.findUnique({ where: { id: tagID }, select: { id: true } }))?.id
          : undefined;
      const news = await tx.news.update({
        where: { id: newsID, deletedAt: null },
        data: {
          ...newsData,
          ...(tagID !== undefined ? { tag: { connect: { id: tagID } } } : {}),
          ...(newsCategoryID !== undefined || tagID !== undefined
            ? categoryID !== undefined
              ? { newsCategory: { connect: { id: categoryID } } }
              : { newsCategory: { disconnect: true } }
            : {}),
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
        const media = await tx.imageMedia.upsert({
          where: { imageUrl: image.media.imageUrl },
          create: image.media,
          update: {},
        });
        if (image.imageType !== "DETAIL") {
          await tx.newsImage.updateMany({
            where: { newsID, imageType: image.imageType, imageID: { not: media.id }, deletedAt: null },
            data: { deletedAt: now },
          });
        }
        const key = { newsID_imageID_imageType: { newsID, imageID: media.id, imageType: image.imageType } };
        const existing = await tx.newsImage.findUnique({ where: key });
        const row = existing
          ? await tx.newsImage.update({
              where: { id: existing.id },
              data: { deletedAt: null, focalPointX: image.focalPointX, focalPointY: image.focalPointY, sortOrder: image.sortOrder ?? 0, updatedAt: now },
            })
          : await tx.newsImage.create({
              data: { newsID, imageID: media.id, imageType: image.imageType, focalPointX: image.focalPointX, focalPointY: image.focalPointY, sortOrder: image.sortOrder ?? 0 },
            });
        imageRows.push({ id: row.id, imageType: row.imageType, imageUrl: media.imageUrl });
        if (image.imageType === "DETAIL") {
          await tx.newsAdditionalImage.create({ data: { newsID, imageUrl: media.imageUrl } });
        }
      }

      if (deletedImageIds.length) {
        const removed = await tx.newsImage.findMany({
          where: { id: { in: deletedImageIds }, newsID, imageType: "DETAIL", deletedAt: null },
          include: { image: true },
        });
        if (removed.length !== new Set(deletedImageIds).size) throw new AppError(ErrorCode.VALIDATION_ERROR, "One or more detail images do not belong to this news", 400);
        await tx.newsImage.updateMany({ where: { id: { in: deletedImageIds }, newsID }, data: { deletedAt: now } });
        for (const row of removed) {
          await tx.newsAdditionalImage.updateMany({ where: { newsID, imageUrl: row.image.imageUrl, deletedAt: null }, data: { deletedAt: now } });
        }
      }

      if (deletedAdditionalImagesId.length) {
        const removed = await tx.newsAdditionalImage.findMany({ where: { id: { in: deletedAdditionalImagesId }, newsID, deletedAt: null } });
        if (removed.length !== new Set(deletedAdditionalImagesId).size) throw new AppError(ErrorCode.VALIDATION_ERROR, "One or more detail images do not belong to this news", 400);
        await tx.newsAdditionalImage.updateMany({ where: { id: { in: deletedAdditionalImagesId }, newsID }, data: { deletedAt: now } });
        const media = await tx.imageMedia.findMany({ where: { imageUrl: { in: removed.map((image) => image.imageUrl) } }, select: { id: true, imageUrl: true } });
        await tx.newsImage.updateMany({ where: { newsID, imageType: "DETAIL", imageID: { in: media.map((image) => image.id) }, deletedAt: null }, data: { deletedAt: now } });
      }

      if (detailImageOrder) {
        const active = await tx.newsImage.findMany({ where: { newsID, imageType: "DETAIL", deletedAt: null } });
        const newIDs = imageRows.filter((row) => row.imageType === "DETAIL").map((row) => row.id);
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
        include: {
          tag: true, newsCategory: true,
          newsImages: { where: { deletedAt: null }, include: { image: true }, orderBy: { sortOrder: "asc" } },
          newsAdditionalImages: { where: { deletedAt: null }, orderBy: { id: "asc" } },
        },
      });
      return {
        ...result,
        category: result.newsCategory,
        images: result.newsImages.map(({ image, ...row }) => ({ ...row, imageUrl: image.imageUrl })),
        tag: result.tag ? { ...result.tag, tagsGroupsId: result.tag.tageGroupsId } : undefined,
      };
    });
  }

}
