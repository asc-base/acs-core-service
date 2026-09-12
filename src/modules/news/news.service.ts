import { AppError } from "../../core/error/app-error";
import { ErrorCode } from "../../core/types/errors";
import { HttpStatusCode } from "../../core/types/http";
import { SupabaseService } from "../../core/utils/supabase";
import {
  CreateNewsDTO,
  NewsDTO,
  NewsQueryParams,
  NewsFeatureDTO,
  NewsWithAdditionalImageDTO,
  UpsertNewsFeatureDTO,
  QueryNewsFeatureParams,
  NewsUpdateDTO,
  NewsCreatePayload,
  NewsUpdatePayload,
  NewsFeatureUpsertPayload,
  NewsAdditionalImageCreatePayload,
  NewsAdditionalImage,
} from "./domain/news";
import { INewsRepository } from "./domain/news.repository";
import { NewsFactory } from "./news.factory";
import { PageableType } from "../../core/models";

interface INewsService {
  createNews(data: CreateNewsDTO, userId: number, additionalImageUrls?: string[]): Promise<NewsDTO>;
  getNews(query: NewsQueryParams): Promise<PageableType<typeof NewsDTO>>;
  getNewsById(id: number): Promise<NewsWithAdditionalImageDTO | null>;
  upsertNewsFeature(
    data: UpsertNewsFeatureDTO,
    userId: number,
  ): Promise<NewsFeatureDTO>;
  getNewsFeatures(
    query: QueryNewsFeatureParams,
  ): Promise<PageableType<typeof NewsFeatureDTO>>;
  getNewsFeatureById(id: number): Promise<NewsFeatureDTO | null>;
}

export class NewsService implements INewsService {
  constructor(
    private readonly newsRepository: INewsRepository,
    private readonly newsFactory: NewsFactory,
    private readonly storageService: SupabaseService,
  ) { }
  async createNews(
    data: CreateNewsDTO,
    userId: number,
  ): Promise<NewsDTO> {
        const {
      thumbnail,
      additionalImages,
      ...newsFields
    } = data;

    let uploadedThumbnailPath: string | null = null;
    let uploadedAdditionalImages: string[] = [];

    try {
      if (!thumbnail) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          "Thumbnail and highlight files are required",
          400,
        );
      }

      // Upload thumbnail
      uploadedThumbnailPath = await this.storageService.uploadFile(
        thumbnail,
        "news-thumbnail",
      );

      // Upload additional images
      if (additionalImages?.length) {
        uploadedAdditionalImages = await Promise.all(
          additionalImages.map((file) =>
            this.storageService.uploadFile(
              file,
              "news-additionalImage",
            ),
          ),
        );
      }

      // Create news
      const newsData: NewsCreatePayload = {
        ...newsFields,
        image: uploadedThumbnailPath,
        thumbnail: uploadedThumbnailPath,
        createdBy: userId,
        updatedBy: userId,
      };

      const news = await this.newsRepository.createNews(newsData);

      // Create additional images
      let newsAdditionalImages: NewsAdditionalImage[] = [];

      if (uploadedAdditionalImages.length > 0) {
        const additionalImageData: NewsAdditionalImageCreatePayload[] =
          uploadedAdditionalImages.map((imageUrl) => ({
            newsID: news.id,
            imageUrl,
            createdBy: userId,
            updatedBy: userId,
          }));

        newsAdditionalImages =
          await this.newsRepository.createNewsAdditionalImages(
            additionalImageData,
          );
      }

      const newsWithAdditionalImages = {
        ...news,
        newsAdditionalImages,
      };

      return this.newsFactory.mapNewsWithAdditionalImageToDTO(
        newsWithAdditionalImages,
      );
    } catch (error) {
      if (uploadedThumbnailPath) {
        await this.storageService
          .deleteFile(uploadedThumbnailPath)
          .catch((err) => {
            console.error("🔥 Failed to delete file during rollback:", err);
          });
      }
      throw error;
    }
  }

  async getNews(query: NewsQueryParams): Promise<PageableType<typeof NewsDTO>> {
    const [newsList, countNews] = await Promise.all([
      this.newsRepository.getNews(query),
      this.newsRepository.countNews(query),
    ]);

    return {
      rows: this.newsFactory.mapNewsListToDTO(newsList),
      totalRecords: countNews,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  async getNewsById(id: number): Promise<NewsWithAdditionalImageDTO | null> {
    try {
      const news = await this.newsRepository.getNewsById(id);

      if (!news) {
        return null;
      }

      return this.newsFactory.mapNewsWithAdditionalImageToDTO(news);

    } catch (error) {
      if (
        error instanceof AppError &&
        error.statusCode === HttpStatusCode.NOT_FOUND
      ) {
        return null;
      }
      throw error;
    }
  }

  async upsertNewsFeature(data: UpsertNewsFeatureDTO, userId: number): Promise<NewsFeatureDTO> {
    try {
      const { thumbnail, highlight, id, ...rest } = data;

      let thumbnailURL: string;
      let highlightURL: string | undefined = undefined;

      if (typeof thumbnail === "string") {
        thumbnailURL = thumbnail;
      } else {
        if (!thumbnail) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            "Thumbnail file is required",
            400,
          );
        }

        thumbnailURL = await this.storageService.uploadFile(
          thumbnail,
          "news-features",
        );
      }

      if (typeof highlight === "string") {
        highlightURL = highlight;
      } else if (highlight) {
        highlightURL = await this.storageService.uploadFile(
          highlight,
          "news-features",
        );
      }

      const newsFeatureData: NewsFeatureUpsertPayload = {
        ...rest,
        thumbnailURL,
        highlightURL,
        createdBy: userId,
        updatedBy: userId,
      };

      if (!id) {
        const newsFeature = await this.newsRepository.createNewsFeature(
          newsFeatureData,
        );
        return this.newsFactory.mapNewsFeatureToDTO(newsFeature);
      }

      const newsFeature = await this.newsRepository.updateNewsFeature(
        id,
        newsFeatureData,
      );
      return this.newsFactory.mapNewsFeatureToDTO(newsFeature);
    } catch (error) {
      console.error("🔥 Error in upsertNewsFeature:", error);

      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        "Failed to upsert news feature",
        500,
      );
    }
  }

  async getNewsFeatures(
    query: QueryNewsFeatureParams,
  ): Promise<PageableType<typeof NewsFeatureDTO>> {
    const [newsFeatures, countNewsFeatures] = await Promise.all([
      this.newsRepository.getNewsFeaturesBy(query),
      this.newsRepository.countNewsFeatures(query),
    ]);

    return {
      rows: this.newsFactory.mapNewsFeatureListToDTO(newsFeatures),
      totalRecords: countNewsFeatures,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };
  }

  async getNewsFeatureById(id: number): Promise<NewsFeatureDTO | null> {
    try {
      const newsFeature = await this.newsRepository.getNewsFeatureById(id);

      if (!newsFeature) {
        return null;
      }
      return this.newsFactory.mapNewsFeatureToDTO(newsFeature);
    } catch (error) {
      if (
        error instanceof AppError &&
        error.statusCode === HttpStatusCode.NOT_FOUND
      ) {
        return null;
      }
      throw error;
    }
  }

  async deleteNews(id: number): Promise<NewsDTO | null> {
    const news = await this.newsRepository.deleteNews(id);
    if (!news) {
      throw new AppError(
        ErrorCode.NOT_FOUND_ERROR,
        "News not found",
        HttpStatusCode.NOT_FOUND,
      );
    }
    return this.newsFactory.mapNewsToDTO(news);
  }

  async updateNews(
  newsID: number,
  data: NewsUpdateDTO,
  userID: number,
): Promise<NewsWithAdditionalImageDTO> {
  const {
    thumbnail,
    deletedAdditionalImagesId,
    newAdditionalImages,
    ...newsData
  } = data;

  let thumbnailPath: string | undefined;
  let uploadedAdditionalImages: string[] = [];

  try {
    if (thumbnail) {
      thumbnailPath = await this.storageService.uploadFile(
        thumbnail,
        "news-thumbnail",
      );
    }

    if (newAdditionalImages?.length) {
      uploadedAdditionalImages = await Promise.all(
        newAdditionalImages.map((file) =>
          this.storageService.uploadFile(
            file,
            "news-additionalImage",
          ),
        ),
      );
    }

    const updateNewsData: NewsUpdatePayload = {
      ...newsData,
      ...(thumbnailPath && {
        thumbnail: thumbnailPath,
      }),
      updatedBy: userID,
      updatedAt: new Date(),
    };

    const news = await this.newsRepository.updateNews(
      newsID,
      updateNewsData,
    );

    if (!news) {
      throw new AppError(
        ErrorCode.NOT_FOUND_ERROR,
        "News not found",
        HttpStatusCode.NOT_FOUND,
      );
    }

    let newsAdditionalImages: NewsAdditionalImage[] = [];

    if (uploadedAdditionalImages.length > 0) {
      const additionalImageData: NewsAdditionalImageCreatePayload[] =
        uploadedAdditionalImages.map((imageUrl) => ({
          newsID: news.id,
          imageUrl,
          createdBy: userID,
          updatedBy: userID,
        }));

      newsAdditionalImages =
        await this.newsRepository.createNewsAdditionalImages(
          additionalImageData,
        );
    }

    if (deletedAdditionalImagesId?.length) {
      await this.newsRepository.deleteNewsAdditionalImages(
        deletedAdditionalImagesId,
      );
    }

    const newsWithAdditionalImages = {
      ...news,
      newsAdditionalImages,
    };

    return this.newsFactory.mapNewsWithAdditionalImageToDTO(
      newsWithAdditionalImages,
    );
  } catch (error) {
    console.log(error);
    throw error;
  }
}
}