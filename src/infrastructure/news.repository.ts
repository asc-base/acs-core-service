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
  NewsAdditionalImage,
  NewsAdditionalImageCreatePayload,
  NewsWithAdditionalImages,
} from "../modules/news/domain/news";
import { AppError } from "../core/error/app-error";
import { ErrorCode } from "../core/types/errors";
import { calculatePagination } from "../core/utils/calculator";
import { PrismaInstance } from "../lib/db";
export class NewsRepository implements INewsRepository {
  constructor(private readonly db: PrismaInstance) { }

  async createNews(data: NewsCreatePayload): Promise<News> {
    //
    const news = await this.db.news.create({ data, include: { tag: true , newsAdditionalImages: true}, });
    return {
      ...news,
      tag: news.tag
        ? {
          ...news.tag,
          tagsGroupsId: news.tag.tageGroupsId,
          // Remove the incorrect property if present
          // Optionally: ...news.tag without 'tageGroupsId'
        }
        : undefined,
    };
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
      },
    });
    return newsList.map((news) => ({
      ...news,
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
          newsAdditionalImages: {
            where: { newsID: id , deletedAt: null },
          },
        }
      });
      if (!news) return null;
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
      highlightURL: newsFeatureData.highlightURL,
      createdBy: newsFeatureData.createdBy ?? 0,
      updatedBy: newsFeatureData.updatedBy ?? 0,
    };

    const newsFeature = await this.db.newsFeatures.create({
      data,
      include: {
        news: {
          include: {
            tag: true,
          },
        },
      },
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
      highlightURL: newsFeatureData.highlightURL,
      updatedBy: newsFeatureData.updatedBy ?? 0,
    };

    const newsFeature = await this.db.newsFeatures.update({
      where: { id },
      data,
      include: {
        news: {
          include: {
            tag: true,
          },
        },
      },
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
        where: { id, deletedAt: null },
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
        deletedAt: null,
      },
    });
    return count;
  }

  async countNewsFeatures(query: QueryNewsFeatureParams): Promise<number> {
    const count = await this.db.newsFeatures.count({
      where: {
        ...(query.tagID && { tagID: query.tagID }),
        deletedAt: null,
      },
    });
    return count;
  }

  async deleteNews(id: number): Promise<News | null> {
    try {
      const news = await this.db.news.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
        include: {
          tag: true,
        },
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
  ): Promise<News> {

    const {
  tagID,
  ...newsData
} = data;
      const news = await this.db.news.update({
        where: { id: newsID },
        data : {
          ...newsData,

    ...(tagID !== undefined && {
      tag: {
        connect: {
          id: tagID,
        },
      },
    }),
        },
        include: { tag: true , newsAdditionalImages: true},
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
  }

async createNewsAdditionalImages(
  data: NewsAdditionalImageCreatePayload[],
): Promise<NewsAdditionalImage[]> {
  const createData: Prisma.NewsAdditionalImageCreateManyInput[] =
    data.map((item) => ({
      newsID: item.newsID,
      imageUrl: item.imageUrl,
      createdBy: item.createdBy ?? 0,
      updatedBy: item.updatedBy ?? 0,
    }));

  return await this.db.newsAdditionalImage.createManyAndReturn({
    data: createData,
  });
}

  async getNewsAdditionalImagesByNewsId(newsID: number): Promise<NewsAdditionalImage[]> {
    return await this.db.newsAdditionalImage.findMany({
      where: { newsID, deletedAt: null },
    });
  }

  async deleteNewsAdditionalImages(
  data: number[],
): Promise<NewsAdditionalImage[]> {
  return await this.db.newsAdditionalImage.updateManyAndReturn({
    where: {
      id: {
        in: data,
      },
    },
    data: {
      deletedAt: new Date(),
    },
  });
}
}

