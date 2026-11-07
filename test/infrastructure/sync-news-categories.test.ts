import { describe, expect, test, vi } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { syncNewsCategories } from "../../src/infrastructure/sync-news-categories";

describe("news category seed", () => {
  test("creates the three code-based categories and resets the sequence", async () => {
    const tx = { newsCategory: { upsert: vi.fn() }, $executeRaw: vi.fn() };
    const db = { $transaction: (callback: (transaction: unknown) => unknown) => callback(tx) } as unknown as PrismaClient;

    await syncNewsCategories(db);

    expect(tx.newsCategory.upsert).toHaveBeenCalledWith({
      where: { code: "ANNOUNCEMENT" },
      update: {},
      create: { id: 1, code: "ANNOUNCEMENT", name: "ข่าวประชาสัมพันธ์" },
    });
    expect(tx.newsCategory.upsert).toHaveBeenCalledTimes(3);
    expect(tx.$executeRaw).toHaveBeenCalledOnce();
  });
});
