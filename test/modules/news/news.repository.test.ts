import { describe, expect, test, vi } from "vitest";
import { NewsRepository } from "../../../src/infrastructure/news.repository";
import type { PrismaInstance } from "../../../src/lib/db";
import type { NewsUpdatePayload } from "../../../src/modules/news/domain/news";

describe("NewsRepository detail-image ownership", () => {
  test("rejects deleting a detail image owned by another news item", async () => {
    const tx = {
      news: { update: vi.fn().mockResolvedValue({ id: 5 }) },
      newsImage: {
        updateMany: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
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
