import { describe, expect, test, vi } from "vitest";
import type { ProfileImageStorage } from "../../../src/infrastructure/profile-image-storage";
import type {
  CreateNewsDTO,
  News,
  NewsCreatePayload,
  NewsFeature,
  NewsWithAdditionalImages,
  NewsUpdatePayload,
} from "../../../src/modules/news/domain/news";
import type { INewsRepository } from "../../../src/modules/news/domain/news.repository";
import { NewsFactory } from "../../../src/modules/news/news.factory";
import { NewsService } from "../../../src/modules/news/news.service";
import { validateNewsImage, MAX_NEWS_IMAGE_SIZE } from "../../../src/modules/news/news-image-validation";

const startDate = new Date("2026-08-02T00:00:00.000Z");

const newsFixture = (focalPoints?: {
  thumbnailFocalPointX?: number;
  thumbnailFocalPointY?: number;
}): News => ({
  id: 1,
  title: "News title",
  detail: "News detail",
  startDate,
  dueDate: null,
  thumbnail: "https://example.com/thumbnail.jpg",
  thumbnailFocalPointX: focalPoints?.thumbnailFocalPointX ?? null,
  thumbnailFocalPointY: focalPoints?.thumbnailFocalPointY ?? null,
  tagID: 1,
  tag: { id: 1, name: "Announcement", tagsGroupsId: 1 },
  createdAt: startDate,
  updatedAt: startDate,
  deletedAt: null,
});

class FakeNewsRepository {
  createdPayload?: NewsCreatePayload;
  updatedPayload?: NewsUpdatePayload;
  news = newsFixture();
  bulletins = new Map<string, { id: number; newsID: number; type: "HIGHLIGHT" | "ANNOUNCEMENT"; news: News }>();

  async createNews(data: NewsCreatePayload): Promise<News> {
    this.createdPayload = data;
    return { ...this.news, newsAdditionalImages: [] } as NewsWithAdditionalImages;
  }

  async getNews(): Promise<News[]> {
    return [this.news];
  }

  async getNewsById(): Promise<NewsWithAdditionalImages | null> {
    return { ...this.news, newsAdditionalImages: [] };
  }

  async upsertNewsFeature(): Promise<NewsFeature> {
    throw new Error("Not implemented");
  }

  async getNewsFeaturesBy(): Promise<NewsFeature[]> {
    return [];
  }

  async countNews(): Promise<number> {
    return 1;
  }

  async countNewsFeatures(): Promise<number> {
    return 0;
  }

  async getNewsFeatureById(): Promise<NewsFeature | null> {
    return null;
  }

  async getNewsBulletins(type: "HIGHLIGHT" | "ANNOUNCEMENT") {
    return [...this.bulletins.values()].filter((bulletin) => bulletin.type === type);
  }

  async setNewsBulletin(newsID: number, type: "HIGHLIGHT" | "ANNOUNCEMENT", enabled: boolean) {
    const key = `${newsID}:${type}`;
    if (!enabled) {
      this.bulletins.delete(key);
      return null;
    }
    const bulletin = { id: 9, newsID, type, news: this.news };
    this.bulletins.set(key, bulletin);
    return bulletin;
  }

  async deleteNews(): Promise<News | null> {
    return null;
  }

  async updateNews(_id: number, data: NewsUpdatePayload): Promise<NewsWithAdditionalImages> {
    this.updatedPayload = data;
    return { ...this.news, newsAdditionalImages: [] } as NewsWithAdditionalImages;
  }
}

const png = () => new File([Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"))], "thumbnail.png", { type: "image/png" });

const createNewsInput = (focalPoints?: {
  thumbnailFocalPointX?: number;
  thumbnailFocalPointY?: number;
}): CreateNewsDTO => ({
  title: "News title",
  detail: "News detail",
  startDate,
  thumbnail: png(),
  tagID: 1,
  ...focalPoints,
});

const createService = (repository: FakeNewsRepository) => {
  let uploaded = 0;
  const deleted: string[] = [];
  const storage = {
    provider: "rustfs",
    upload: vi.fn(async (file: File, _contentType: string, folder: string) => {
      const fileKey = `public/${folder}/${++uploaded}`;
      return { provider: "rustfs" as const, bucket: "media", fileKey, imageUrl: `https://example.com/${fileKey}` };
    }),
    delete: async (_bucket: string, fileKey: string) => { deleted.push(fileKey); },
  } as ProfileImageStorage;

  return { service: new NewsService(repository as unknown as INewsRepository, new NewsFactory(), storage), storage, deleted };
};

describe("NewsService", () => {
  test("validates bytes, format, and per-file size", async () => {
    expect(await validateNewsImage(png())).toBe("image/png");
    await expect(validateNewsImage(new File(["not an image"], "fake.png", { type: "image/png" }))).rejects.toMatchObject({ statusCode: 415 });
    await expect(validateNewsImage(new File([new Uint8Array(MAX_NEWS_IMAGE_SIZE + 1)], "large.png"))).rejects.toMatchObject({ statusCode: 413 });
  });

  test("creates separate cover roles and ordered detail images", async () => {
    const repository = new FakeNewsRepository();
    const { service, storage } = createService(repository);
    const input = {
      ...createNewsInput(),
      cardImage: png(),
      thumbnailImage: png(),
      detailImages: [png(), png()],
      cardFocalPointX: 20,
      cardFocalPointY: 35,
      thumbnailFocalPointX: 60,
      thumbnailFocalPointY: 75,
    };

    await service.createNews(input);

    expect(repository.createdPayload?.images?.map((image) => image.imageType)).toEqual([
      "CARD", "THUMBNAIL", "DETAIL", "DETAIL",
    ]);
    expect(repository.createdPayload?.images?.filter((image) => image.imageType === "DETAIL").map((image) => image.sortOrder)).toEqual([0, 1]);
    expect(repository.createdPayload?.images?.[0]).toMatchObject({ focalPointX: 20, focalPointY: 35 });
    expect(repository.createdPayload?.images?.[1]).toMatchObject({ focalPointX: 60, focalPointY: 75 });
    expect(storage.upload).toHaveBeenCalledTimes(4);
  });

  test("reuses one upload for card and thumbnail and removes uploaded files on database failure", async () => {
    const repository = new FakeNewsRepository();
    repository.createNews = async () => { throw new Error("database failure"); };
    const { service, storage, deleted } = createService(repository);

    await expect(service.createNews(createNewsInput())).rejects.toThrow("database failure");

    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(deleted).toEqual(["public/news/images/1"]);
  });

  test("rejects a spoofed image before it reaches storage", async () => {
    const repository = new FakeNewsRepository();
    const { service, storage } = createService(repository);
    await expect(service.createNews({
      ...createNewsInput(),
      thumbnail: new File(["not an image"], "fake.png", { type: "image/png" }),
    })).rejects.toMatchObject({ statusCode: 415 });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  test("enables and disables a bulletin while returning its linked news", async () => {
    const repository = new FakeNewsRepository();
    const { service } = createService(repository);

    const enabled = await service.setNewsBulletin(1, "HIGHLIGHT", true);
    expect(enabled).toMatchObject({ id: 9, newsID: 1, type: "HIGHLIGHT", news: { id: 1 } });
    expect(await service.getNewsBulletins("HIGHLIGHT")).toHaveLength(1);

    const disabled = await service.setNewsBulletin(1, "HIGHLIGHT", false);
    expect(disabled).toBeNull();
    expect(await service.getNewsBulletins("HIGHLIGHT")).toEqual([]);
  });

  test("updates detail images with the requested order and scoped deletions", async () => {
    const repository = new FakeNewsRepository();
    repository.news = {
      ...newsFixture(),
      images: [
        { id: 7, imageID: 70, imageType: "DETAIL", imageUrl: "https://example.com/7.jpg", focalPointX: null, focalPointY: null, sortOrder: 0 },
        { id: 8, imageID: 80, imageType: "DETAIL", imageUrl: "https://example.com/8.jpg", focalPointX: null, focalPointY: null, sortOrder: 1 },
      ],
    };
    const { service } = createService(repository);

    await service.updateNews(1, {
      detailImages: [png()],
      deletedImageIds: JSON.stringify([8]),
      detailImageOrder: JSON.stringify(["7", "new:0"]),
    });

    expect(repository.updatedPayload?.deletedImageIds).toEqual([8]);
    expect(repository.updatedPayload?.detailImageOrder).toEqual(["7", "new:0"]);
    expect(repository.updatedPayload?.images?.map((image) => image.imageType)).toEqual(["DETAIL"]);
  });

  test("creates news with thumbnail focal points", async () => {
    const repository = new FakeNewsRepository();
    repository.news = newsFixture({
      thumbnailFocalPointX: 40,
      thumbnailFocalPointY: 60,
    });
    const { service } = createService(repository);

    const result = await service.createNews(
      createNewsInput({
        thumbnailFocalPointX: 40,
        thumbnailFocalPointY: 60,
      }),
    );

    expect(repository.createdPayload).toMatchObject({
      thumbnailFocalPointX: 40,
      thumbnailFocalPointY: 60,
    });
    expect(result).toMatchObject({
      thumbnailFocalPointX: 40,
      thumbnailFocalPointY: 60,
    });
  });

  test("creates news without focal points", async () => {
    const repository = new FakeNewsRepository();
    const { service } = createService(repository);

    const result = await service.createNews(createNewsInput());

    expect(repository.createdPayload).not.toHaveProperty(
      "thumbnailFocalPointX",
    );
    expect(repository.createdPayload).not.toHaveProperty(
      "thumbnailFocalPointY",
    );
    expect(result).toMatchObject({
      thumbnailFocalPointX: null,
      thumbnailFocalPointY: null,
    });
  });

  test("returns focal points from getNews", async () => {
    const repository = new FakeNewsRepository();
    repository.news = newsFixture({ thumbnailFocalPointX: 20, thumbnailFocalPointY: 80 });
    const { service } = createService(repository);

    const result = await service.getNews({});

    expect(result).toMatchObject({
      rows: [
        {
          id: 1,
          thumbnailFocalPointX: 20,
          thumbnailFocalPointY: 80,
        },
      ],
      totalRecords: 1,
    });
  });

  test("returns news without focal points from getNewsById", async () => {
    const repository = new FakeNewsRepository();
    const { service } = createService(repository);

    const result = await service.getNewsById(1);

    expect(result).toMatchObject({
      id: 1,
      thumbnailFocalPointX: null,
      thumbnailFocalPointY: null,
    });
  });
});
