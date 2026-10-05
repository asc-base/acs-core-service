import { AppError } from "../../core/error/app-error";
import type { Static } from "elysia";
import { ErrorCode } from "../../core/types/errors";
import { HttpStatusCode } from "../../core/types/http";
import { ProfileImageStorage, StoredImage } from "../../infrastructure/profile-image-storage";
import { validateNewsImage } from "./news-image-validation";
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
  NewsImageInput,
  NewsBulletinType,
  NewsBulletinDTO,
} from "./domain/news";
import { INewsRepository } from "./domain/news.repository";
import { NewsFactory } from "./news.factory";
import { PageableType } from "../../core/models";

interface INewsService {
  createNews(data: CreateNewsDTO): Promise<NewsDTO>;
  getNews(query: NewsQueryParams): Promise<PageableType<typeof NewsDTO>>;
  getNewsById(id: number): Promise<NewsWithAdditionalImageDTO | null>;
  upsertNewsFeature(
    data: UpsertNewsFeatureDTO,
  ): Promise<NewsFeatureDTO>;
  getNewsFeatures(
    query: QueryNewsFeatureParams,
  ): Promise<PageableType<typeof NewsFeatureDTO>>;
  getNewsFeatureById(id: number): Promise<NewsFeatureDTO | null>;
  getNewsBulletins(type: NewsBulletinType): Promise<Array<Static<typeof NewsBulletinDTO>>>;
  setNewsBulletin(newsID: number, type: NewsBulletinType, enabled: boolean): Promise<Static<typeof NewsBulletinDTO> | null>;
}

export class NewsService implements INewsService {
  constructor(
    private readonly newsRepository: INewsRepository,
    private readonly newsFactory: NewsFactory,
    private readonly storageService: ProfileImageStorage,
  ) { }
  async createNews(
    data: CreateNewsDTO,
  ): Promise<NewsDTO> {
    const cardFile = data.cardImage ?? data.thumbnail ?? data.thumbnailImage;
    const thumbnailFile = data.thumbnailImage ?? data.cardImage ?? data.thumbnail;
    const detailFiles = data.detailImages ?? data.additionalImages ?? [];
    const categoryID = data.newsCategoryId ?? data.tagID;
    const eventStartAt = data.eventStartAt ?? data.startDate;
    const eventEndAt = data.eventEndAt ?? data.dueDate ?? null;
    if (!cardFile || !thumbnailFile || !categoryID || !eventStartAt) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Card image, category, and event start are required", 400);
    }
    if (data.tagID && data.newsCategoryId && data.tagID !== data.newsCategoryId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Legacy tagID and newsCategoryId must match", 400);
    }
    if (data.startDate && data.eventStartAt && data.startDate.getTime() !== data.eventStartAt.getTime()) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Legacy startDate and eventStartAt must match", 400);
    }
    if (data.dueDate && data.eventEndAt && data.dueDate.getTime() !== data.eventEndAt.getTime()) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Legacy dueDate and eventEndAt must match", 400);
    }
    if (data.detailImages?.length && data.additionalImages?.length && data.detailImages !== data.additionalImages) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Send detailImages or additionalImages, not both", 400);
    }
    if (detailFiles.length > 10) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "News can have at most 10 detail images", 400);
    }

    const files = [...new Set([cardFile, thumbnailFile, ...detailFiles])];
    const detectedTypes = new Map<File, string>();
    for (const file of files) detectedTypes.set(file, await validateNewsImage(file));

    const uploaded: StoredImage[] = [];
    const uploadedByFile = new Map<File, StoredImage>();
    const upload = async (file: File, folder: string) => {
      const stored = uploadedByFile.get(file) ?? await this.storageService.upload(file, detectedTypes.get(file)!, folder);
      if (!uploadedByFile.has(file)) {
        uploadedByFile.set(file, stored);
        uploaded.push(stored);
      }
      return stored;
    };

    try {
      const card = await upload(cardFile, "news/images");
      const thumbnail = await upload(thumbnailFile, "news/images");
      const details: StoredImage[] = [];
      for (const file of detailFiles) details.push(await upload(file, "news/images"));
      const images: NewsImageInput[] = [
        { imageType: "CARD", media: { ...card, fileName: cardFile.name, contentType: detectedTypes.get(cardFile), fileSize: cardFile.size }, focalPointX: data.cardFocalPointX ?? data.thumbnailFocalPointX ?? null, focalPointY: data.cardFocalPointY ?? data.thumbnailFocalPointY ?? null },
        { imageType: "THUMBNAIL", media: { ...thumbnail, fileName: thumbnailFile.name, contentType: detectedTypes.get(thumbnailFile), fileSize: thumbnailFile.size }, focalPointX: data.thumbnailFocalPointX ?? null, focalPointY: data.thumbnailFocalPointY ?? null },
        ...details.map((media, sortOrder) => {
          const file = detailFiles[sortOrder];
          return { imageType: "DETAIL" as const, media: { ...media, fileName: file.name, contentType: detectedTypes.get(file), fileSize: file.size }, sortOrder };
        }),
      ];
      const cardFocalPointX = data.cardFocalPointX ?? data.thumbnailFocalPointX;
      const cardFocalPointY = data.cardFocalPointY ?? data.thumbnailFocalPointY;
      const payload: NewsCreatePayload = {
        title: data.title,
        detail: data.detail,
        tagID: categoryID,
        ...(data.newsCategoryId ? { newsCategoryID: data.newsCategoryId } : {}),
        startDate: eventStartAt,
        dueDate: eventEndAt,
        eventStartAt,
        eventEndAt,
        thumbnail: card.imageUrl,
        ...(cardFocalPointX !== undefined ? { thumbnailFocalPointX: cardFocalPointX } : {}),
        ...(cardFocalPointY !== undefined ? { thumbnailFocalPointY: cardFocalPointY } : {}),
        images,
        additionalImageUrls: details.map((image) => image.imageUrl),
      };
      const news = await this.newsRepository.createNews(payload);
      return this.newsFactory.mapNewsWithAdditionalImageToDTO(news as never);
    } catch (error) {
      for (const image of uploaded.reverse()) {
        if (!image.fileKey || !image.bucket) continue;
        await this.storageService.delete(image.bucket, image.fileKey).catch((cleanupError) => {
          console.error("Failed to delete media after news rollback:", cleanupError);
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

  async upsertNewsFeature(data: UpsertNewsFeatureDTO): Promise<NewsFeatureDTO> {
    let uploaded: StoredImage | undefined;
    try {
      const { thumbnail, id, ...rest } = data;

      let thumbnailURL: string;
      let media: NewsImageInput["media"];

      if (typeof thumbnail === "string") {
        thumbnailURL = thumbnail;
        media = { provider: "legacy_url", imageUrl: thumbnail };
      } else {
        if (!thumbnail) {
          throw new AppError(
            ErrorCode.VALIDATION_ERROR,
            "Thumbnail file is required",
            400,
          );
        }

        const contentType = await validateNewsImage(thumbnail);
        uploaded = await this.storageService.upload(thumbnail, contentType, "news/images");
        thumbnailURL = uploaded.imageUrl;
        media = { ...uploaded, fileName: thumbnail.name, contentType, fileSize: thumbnail.size };
      }

      const newsFeatureData: NewsFeatureUpsertPayload = {
        ...rest,
        thumbnailURL,
        media,
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
      if (uploaded?.bucket && uploaded.fileKey) {
        await this.storageService.delete(uploaded.bucket, uploaded.fileKey).catch(() => undefined);
      }
      if (error instanceof AppError) throw error;
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

  async getNewsBulletins(type: NewsBulletinType): Promise<Array<Static<typeof NewsBulletinDTO>>> {
    const rows = await this.newsRepository.getNewsBulletins(type);
    return rows.map(({ news, ...bulletin }) => ({
      ...bulletin,
      news: this.newsFactory.mapNewsToDTO(news),
    }));
  }

  async setNewsBulletin(newsID: number, type: NewsBulletinType, enabled: boolean): Promise<Static<typeof NewsBulletinDTO> | null> {
    const row = await this.newsRepository.setNewsBulletin(newsID, type, enabled);
    if (!row) return null;
    const { news, ...bulletin } = row;
    return { ...bulletin, news: this.newsFactory.mapNewsToDTO(news) };
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
): Promise<NewsWithAdditionalImageDTO> {
  const existing = await this.newsRepository.getNewsById(newsID);
  if (!existing) throw new AppError(ErrorCode.NOT_FOUND_ERROR, "News not found", HttpStatusCode.NOT_FOUND);
  const { thumbnail, cardImage, thumbnailImage, detailImages, newAdditionalImages,
    deletedImageIds, detailImageOrder, deletedAdditionalImagesId = [],
    newsCategoryId, eventStartAt, eventEndAt, cardFocalPointX, cardFocalPointY,
    ...fields } = data;
  const usesMediaContract = newsCategoryId !== undefined || cardImage !== undefined || thumbnailImage !== undefined
    || detailImages !== undefined || deletedImageIds !== undefined || detailImageOrder !== undefined;
  if (thumbnail && cardImage && thumbnail !== cardImage) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Legacy thumbnail and cardImage must match", 400);
  }
  const cardFile = cardImage ?? thumbnail;
  const thumbFile = thumbnailImage ?? (thumbnail ? thumbnail : undefined);
  const detailFiles = detailImages ?? newAdditionalImages ?? [];
  if (detailImages?.length && newAdditionalImages?.length) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Send only one detail image field", 400);
  }
  let deletedIDs: number[] = [];
  if (deletedImageIds) {
    try {
      const parsed: unknown = JSON.parse(deletedImageIds);
      if (!Array.isArray(parsed) || parsed.some((id) => !Number.isInteger(id) || id < 1)) throw new Error();
      deletedIDs = parsed;
    } catch {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "deletedImageIds must be a JSON array of image IDs", 400);
    }
  }
  let detailOrder: string[] | undefined;
  if (detailImageOrder) {
    try {
      const parsed: unknown = JSON.parse(detailImageOrder);
      if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== "string" && !Number.isInteger(id))) throw new Error();
      detailOrder = parsed.map(String);
    } catch {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "detailImageOrder must be a JSON array", 400);
    }
  }
  const currentDetail = existing.images?.filter((image) => image.imageType === "DETAIL") ?? [];
  const legacyDeletedUrls = new Set((existing.newsAdditionalImages ?? []).filter((image) => deletedAdditionalImagesId.includes(image.id)).map((image) => image.imageUrl));
  const remainingCount = currentDetail.filter((image) => !deletedIDs.includes(image.id) && !legacyDeletedUrls.has(image.imageUrl)).length;
  if (detailFiles.length > 0 && remainingCount + detailFiles.length > 10) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "News can have at most 10 detail images", 400);
  }
  const files = [...new Set([cardFile, thumbFile, ...detailFiles].filter((file): file is File => file instanceof File))];
  const cardFocalX = cardFocalPointX ?? (!usesMediaContract ? fields.thumbnailFocalPointX : undefined);
  const cardFocalY = cardFocalPointY ?? (!usesMediaContract ? fields.thumbnailFocalPointY : undefined);
  const detectedTypes = new Map<File, string>();
  for (const file of files) detectedTypes.set(file, await validateNewsImage(file));
  const uploaded: StoredImage[] = [];
  const byFile = new Map<File, StoredImage>();
  const upload = async (file: File) => {
    const stored = byFile.get(file) ?? await this.storageService.upload(file, detectedTypes.get(file)!, "news/images");
    if (!byFile.has(file)) { byFile.set(file, stored); uploaded.push(stored); }
    return stored;
  };
  try {
    const images: NewsImageInput[] = [];
    let cardURL: string | undefined;
    if (cardFile) {
      const media = await upload(cardFile);
      cardURL = media.imageUrl;
      images.push({ imageType: "CARD", media: { ...media, fileName: cardFile.name, contentType: detectedTypes.get(cardFile), fileSize: cardFile.size }, focalPointX: cardFocalX ?? null, focalPointY: cardFocalY ?? null });
    }
    if (thumbFile) {
      const media = await upload(thumbFile);
      images.push({ imageType: "THUMBNAIL", media: { ...media, fileName: thumbFile.name, contentType: detectedTypes.get(thumbFile), fileSize: thumbFile.size }, focalPointX: fields.thumbnailFocalPointX ?? null, focalPointY: fields.thumbnailFocalPointY ?? null });
    }
    const detailMedia: StoredImage[] = [];
    for (const file of detailFiles) {
      const media = await upload(file);
      detailMedia.push(media);
      images.push({ imageType: "DETAIL", media: { ...media, fileName: file.name, contentType: detectedTypes.get(file), fileSize: file.size } });
    }
    const categoryID = newsCategoryId ?? fields.tagID;
    if (newsCategoryId && fields.tagID && newsCategoryId !== fields.tagID) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Legacy tagID and newsCategoryId must match", 400);
    }
    const startAt = eventStartAt ?? fields.startDate;
    const endAt = eventEndAt !== undefined ? eventEndAt : fields.dueDate;
    const { thumbnailFocalPointX, thumbnailFocalPointY, startDate, dueDate, tagID, title, detail } = fields;
    const payload: NewsUpdatePayload = {
      ...(title !== undefined ? { title } : {}),
      ...(detail !== undefined ? { detail } : {}),
      ...(categoryID !== undefined ? { tagID: categoryID } : tagID !== undefined ? { tagID } : {}),
      ...(newsCategoryId !== undefined ? { newsCategoryID: newsCategoryId } : {}),
      ...(startAt !== undefined ? { startDate: startAt, eventStartAt: startAt } : startDate !== undefined ? { startDate } : {}),
      ...(endAt !== undefined ? { dueDate: endAt, eventEndAt: endAt } : dueDate !== undefined ? { dueDate } : {}),
      ...(cardURL ? { thumbnail: cardURL } : {}),
      ...(cardFocalX !== undefined ? { thumbnailFocalPointX: cardFocalX } : {}),
      ...(cardFocalY !== undefined ? { thumbnailFocalPointY: cardFocalY } : {}),
      ...(cardFocalX !== undefined ? { cardFocalPointX: cardFocalX } : {}),
      ...(cardFocalY !== undefined ? { cardFocalPointY: cardFocalY } : {}),
      ...(usesMediaContract && thumbnailFocalPointX !== undefined ? { thumbnailImageFocalPointX: thumbnailFocalPointX } : {}),
      ...(usesMediaContract && thumbnailFocalPointY !== undefined ? { thumbnailImageFocalPointY: thumbnailFocalPointY } : {}),
      updatedAt: new Date(),
      images,
      deletedImageIds: deletedIDs,
      deletedAdditionalImagesId,
      detailImageOrder: detailOrder,
      additionalImageUrls: detailMedia.map((media) => media.imageUrl),
    };
    const news = await this.newsRepository.updateNews(newsID, payload);
    return this.newsFactory.mapNewsWithAdditionalImageToDTO(news);
  } catch (error) {
    for (const image of uploaded.reverse()) {
      if (image.bucket && image.fileKey) await this.storageService.delete(image.bucket, image.fileKey).catch((cleanupError) => console.error("Failed to delete media after news rollback:", cleanupError));
    }
    throw error;
  }
}
}
