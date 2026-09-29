import { describe, expect, test } from "bun:test";
import type { SupabaseService } from "../../../src/core/utils/supabase";
import type {
  CreateNewsDTO,
  News,
  NewsCreatePayload,
  NewsFeature,
  NewsWithAdditionalImages,
} from "../../../src/modules/news/domain/news";
import type { INewsRepository } from "../../../src/modules/news/domain/news.repository";
import { NewsFactory } from "../../../src/modules/news/news.factory";
import { NewsService } from "../../../src/modules/news/news.service";

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

class FakeNewsRepository implements INewsRepository {
  createdPayload?: NewsCreatePayload;
  news = newsFixture();

  async createNews(data: NewsCreatePayload): Promise<News> {
    this.createdPayload = data;
    return this.news;
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

  async deleteNews(): Promise<News | null> {
    return null;
  }

  async updateNews(): Promise<News | null> {
    return null;
  }
}

const createNewsInput = (focalPoints?: {
  thumbnailFocalPointX?: number;
  thumbnailFocalPointY?: number;
}): CreateNewsDTO => ({
  title: "News title",
  detail: "News detail",
  startDate,
  thumbnail: new File(["thumbnail"], "thumbnail.jpg", {
    type: "image/jpeg",
  }),
  tagID: 1,
  ...focalPoints,
});

const createService = (repository: FakeNewsRepository) => {
  const storage = {
    uploadFile: async (file: File, folder: string) =>
      `https://example.com/${folder}/${file.name}`,
    deleteFile: async () => undefined,
  } as unknown as SupabaseService;

  return new NewsService(repository, new NewsFactory(), storage);
};

describe("NewsService", () => {
  test("creates news with thumbnail focal points", async () => {
    const repository = new FakeNewsRepository();
    repository.news = newsFixture({
      thumbnailFocalPointX: 40,
      thumbnailFocalPointY: 60,
    });
    const service = createService(repository);

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
    const service = createService(repository);

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
    const service = createService(repository);

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
    const service = createService(repository);

    const result = await service.getNewsById(1);

    expect(result).toMatchObject({
      id: 1,
      thumbnailFocalPointX: null,
      thumbnailFocalPointY: null,
    });
  });
});
