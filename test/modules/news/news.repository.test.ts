import { describe, expect, test, vi } from "vitest";
import { NewsRepository } from "../../../src/infrastructure/news.repository";
import type { PrismaInstance } from "../../../src/lib/db";
import type { NewsUpdatePayload } from "../../../src/modules/news/domain/news";

describe("NewsRepository category IDs", () => {
  test("uses the category ID for both rows and totals", async () => {
    const tx = {
      newsCategory: { findUnique: vi.fn().mockResolvedValue({ id: 1 }) },
      news: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    };
    const repository = new NewsRepository(tx as unknown as PrismaInstance);
    const query = { newsCategoryId: 1, page: 1, pageSize: 10 };

    await repository.getNews(query);
    await repository.countNews(query);

    expect(tx.news.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { newsCategoryID: 1, deletedAt: null } }));
    expect(tx.news.count).toHaveBeenCalledWith({ where: { newsCategoryID: 1, deletedAt: null } });
  });

  test("keeps the category relation untouched when an update omits it", async () => {
    const tx = {
      news: {
        update: vi.fn().mockResolvedValue({ id: 7 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 7,
          newsCategory: { id: 1, code: "ANNOUNCEMENT", name: "ข่าวประชาสัมพันธ์" },
          newsImages: [],
          newsAdditionalImages: [],
        }),
      },
    };
    const db = { $transaction: (callback: (transaction: unknown) => unknown) => callback(tx) } as unknown as PrismaInstance;
    const repository = new NewsRepository(db);

    await repository.updateNews(7, { title: "Updated" });

    expect(tx.news.update).toHaveBeenCalledWith({ where: { id: 7, deletedAt: null }, data: { title: "Updated" } });
  });

  test("rejects unknown category filters", async () => {
    const db = {
      newsCategory: { findUnique: vi.fn().mockResolvedValue(null) },
      news: { findMany: vi.fn(), count: vi.fn() },
    } as unknown as PrismaInstance;
    const repository = new NewsRepository(db);

    await expect(repository.getNews({ newsCategoryId: 99 })).rejects.toMatchObject({ statusCode: 400 });
  });

  test("creates news directly with the selected category", async () => {
    const category = { id: 1, code: "ANNOUNCEMENT", name: "ข่าวประชาสัมพันธ์" };
    const tx = {
      newsCategory: { findUnique: vi.fn().mockResolvedValue(category) },
      news: { create: vi.fn().mockResolvedValue({
        id: 7,
        newsCategory: category,
        newsImages: [],
        newsAdditionalImages: [],
      }) },
    };
    const db = { $transaction: (callback: (transaction: unknown) => unknown) => callback(tx) } as unknown as PrismaInstance;
    const repository = new NewsRepository(db);

    await repository.createNews({
      title: "News",
      detail: "Details",
      startDate: new Date("2026-10-12T00:00:00.000Z"),
      dueDate: null,
      thumbnail: "https://example.test/card.png",
      newsCategoryID: 1,
    });

    expect(tx.news.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ newsCategory: { connect: { id: 1 } } }),
    }));
  });
});

describe("NewsRepository detail-image ownership", () => {
  test("rejects deleting a detail image owned by another news item", async () => {
    const tx = {
      news: { update: vi.fn().mockResolvedValue({ id: 5 }) },
      newsImage: { updateMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    };
    const db = { $transaction: (callback: (transaction: unknown) => unknown) => callback(tx) } as unknown as PrismaInstance;
    const repository = new NewsRepository(db);

    await expect(repository.updateNews(5, { deletedImageIds: [77] } as NewsUpdatePayload))
      .rejects.toThrow("One or more detail images do not belong to this news");
    expect(tx.newsImage.findMany).toHaveBeenCalledWith({
      where: { id: { in: [77] }, newsID: 5, imageType: "DETAIL", deletedAt: null },
      include: { image: true },
    });
    expect(tx.newsImage.updateMany).not.toHaveBeenCalled();
  });
});
